import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FinancialWidget from './FinancialWidget';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FinancialWidget', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<FinancialWidget />);

    expect(screen.getByText('Loading financial data...')).toBeInTheDocument();
  });

  it('should display financial data on successful fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ytdRevenue: 125000.5,
          monthlyRevenue: 18500.75,
          weeklyRevenue: 4200,
          ytdPatientsSeen: 312,
        },
      }),
    });

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('$125,000.50')).toBeInTheDocument();
      expect(screen.getByText('$18,500.75')).toBeInTheDocument();
      expect(screen.getByText('$4,200.00')).toBeInTheDocument();
      expect(screen.getByText('312')).toBeInTheDocument();
    });
  });

  it('should display all stat card labels', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ytdRevenue: 50000,
          monthlyRevenue: 10000,
          weeklyRevenue: 2500,
          ytdPatientsSeen: 150,
        },
      }),
    });

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('YTD Revenue')).toBeInTheDocument();
      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByText('Weekly Revenue')).toBeInTheDocument();
      expect(screen.getByText('YTD Patients Seen')).toBeInTheDocument();
    });
  });

  it('should display error state when API returns non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
    });

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('Financial data unavailable')).toBeInTheDocument();
    });
  });

  it('should display error state when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('Financial data unavailable')).toBeInTheDocument();
    });
  });

  it('should display error state when API returns success: false', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Unauthorized',
      }),
    });

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('Financial data unavailable')).toBeInTheDocument();
    });
  });

  it('should format currency values with dollar sign and commas', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ytdRevenue: 1234567.89,
          monthlyRevenue: 0,
          weeklyRevenue: 999.99,
          ytdPatientsSeen: 1000,
        },
      }),
    });

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('$999.99')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });
  });

  it('should fetch from /api/dashboard/financial endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ytdRevenue: 0,
          monthlyRevenue: 0,
          weeklyRevenue: 0,
          ytdPatientsSeen: 0,
        },
      }),
    });
    global.fetch = fetchMock;

    render(<FinancialWidget />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/financial');
    });
  });
});
