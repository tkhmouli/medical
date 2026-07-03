import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DashboardClient from './DashboardClient';
import type { DashboardStats } from '@/lib/services/dashboard-service';

// ─── Mock child widgets that fetch independently ────────────────────────────

vi.mock('./FinancialWidget', () => ({
  default: () => <div data-testid="financial-widget">Financial Widget</div>,
}));

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockUser = { userId: 'user-1', role: 'Doctor' as const, name: 'Dr. Smith' };

const mockStats: DashboardStats = {
  today: [
    {
      id: 'apt-1',
      patientName: 'John Doe',
      startTime: '09:00',
      duration: 30,
      visitType: 'Consultation',
      status: 'waiting',
    },
    {
      id: 'apt-2',
      patientName: 'Jane Roe',
      startTime: '10:00',
      duration: 45,
      visitType: 'Follow-up',
      status: 'completed',
    },
  ],
  tomorrow: [
    {
      id: 'apt-3',
      patientName: 'Bob Brown',
      startTime: '08:30',
      duration: 30,
      visitType: 'New Patient',
      status: 'scheduled',
    },
  ],
  waitingCount: 1,
  seenCount: 1,
};

const emptyStats: DashboardStats = {
  today: [],
  tomorrow: [],
  waitingCount: 0,
  seenCount: 0,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should render welcome message with user name', () => {
    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    expect(screen.getByText('Welcome back, Dr. Smith')).toBeInTheDocument();
  });

  it('should render status counters with initial stats', () => {
    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    expect(screen.getByText('Waiting Room')).toBeInTheDocument();
    expect(screen.getByText('Patients Seen')).toBeInTheDocument();
  });

  it('should render today schedule section with appointments', () => {
    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Roe')).toBeInTheDocument();
  });

  it('should render tomorrow schedule section with appointments', () => {
    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    expect(screen.getByText("Tomorrow's Schedule")).toBeInTheDocument();
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
  });

  it('should show empty state messages when no appointments', () => {
    render(<DashboardClient user={mockUser} initialStats={emptyStats} />);

    expect(screen.getByText('No appointments scheduled for today.')).toBeInTheDocument();
    expect(screen.getByText('No appointments scheduled for tomorrow.')).toBeInTheDocument();
  });

  it('should render date picker control', () => {
    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    expect(screen.getByLabelText('View schedule for:')).toBeInTheDocument();
  });

  it('should poll /api/dashboard/stats every 30 seconds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockStats }),
    });
    global.fetch = fetchMock;

    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    // No fetch call on initial render (only setInterval)
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance timer by 30s
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/stats');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance another 30s
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should handle polling errors silently', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    // Advance timer — error should not crash
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // Component should still render correctly after failed poll
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should fetch schedule when a date is selected', async () => {
    vi.useRealTimers();

    const dateSchedule = [
      {
        id: 'apt-5',
        patientName: 'Alice Walker',
        startTime: '11:00',
        duration: 30,
        visitType: 'Consultation',
        status: 'scheduled' as const,
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: dateSchedule }),
    });
    global.fetch = fetchMock;

    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    const datePicker = screen.getByLabelText('View schedule for:');
    await act(async () => {
      fireEvent.change(datePicker, { target: { value: '2024-06-15' } });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/stats?date=2024-06-15');
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    });
  });

  it('should hide today/tomorrow sections when a date is selected', async () => {
    vi.useRealTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = fetchMock;

    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    const datePicker = screen.getByLabelText('View schedule for:');
    await act(async () => {
      fireEvent.change(datePicker, { target: { value: '2024-06-15' } });
    });

    await waitFor(() => {
      expect(screen.queryByText("Today's Schedule")).not.toBeInTheDocument();
      expect(screen.queryByText("Tomorrow's Schedule")).not.toBeInTheDocument();
    });
  });

  it('should show Clear button and revert when clicked', async () => {
    vi.useRealTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = fetchMock;

    render(<DashboardClient user={mockUser} initialStats={mockStats} />);

    const datePicker = screen.getByLabelText('View schedule for:');
    await act(async () => {
      fireEvent.change(datePicker, { target: { value: '2024-06-15' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Clear'));
    });

    // Should revert to today/tomorrow view
    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow's Schedule")).toBeInTheDocument();
  });
});
