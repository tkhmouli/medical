import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import WeatherWidget from './WeatherWidget';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WeatherWidget', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should display loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<WeatherWidget />);

    expect(screen.getByText('Loading weather...')).toBeInTheDocument();
  });

  it('should display weather data on successful fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { temperature: 22, condition: 'clear sky', icon: '01d' },
      }),
    });

    render(<WeatherWidget />);

    await waitFor(() => {
      expect(screen.getByText('22°C')).toBeInTheDocument();
      expect(screen.getByText('clear sky')).toBeInTheDocument();
    });

    const img = screen.getByAltText('clear sky');
    expect(img).toHaveAttribute('src', 'https://openweathermap.org/img/wn/01d@2x.png');
  });

  it('should display fallback message when data is null', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: null,
        message: 'Weather data unavailable',
      }),
    });

    render(<WeatherWidget />);

    await waitFor(() => {
      expect(screen.getByText('Weather data unavailable')).toBeInTheDocument();
    });
  });

  it('should display fallback message on fetch error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<WeatherWidget />);

    await waitFor(() => {
      expect(screen.getByText('Weather data unavailable')).toBeInTheDocument();
    });
  });

  it('should display fallback message on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<WeatherWidget />);

    await waitFor(() => {
      expect(screen.getByText('Weather data unavailable')).toBeInTheDocument();
    });
  });

  it('should refresh weather data every 30 minutes', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { temperature: 18, condition: 'overcast clouds', icon: '04d' },
      }),
    });
    global.fetch = fetchMock;

    await act(async () => {
      render(<WeatherWidget />);
    });

    // Initial fetch on mount
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/weather');

    // Advance by 30 minutes
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance another 30 minutes
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should render weather icon with correct URL', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { temperature: 5, condition: 'light snow', icon: '13n' },
      }),
    });

    render(<WeatherWidget />);

    await waitFor(() => {
      const img = screen.getByAltText('light snow');
      expect(img).toHaveAttribute('src', 'https://openweathermap.org/img/wn/13n@2x.png');
    });
  });
});
