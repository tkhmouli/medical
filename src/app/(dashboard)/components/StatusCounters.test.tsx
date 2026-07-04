import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusCounters from './StatusCounters';

describe('StatusCounters', () => {
  it('should render waiting room counter with correct count', () => {
    render(<StatusCounters waitingCount={3} seenCount={5} />);

    expect(screen.getByText('Waiting Room')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should render completed counter with correct count', () => {
    render(<StatusCounters waitingCount={3} seenCount={5} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render total patients today as 0 when no appointments passed', () => {
    render(<StatusCounters waitingCount={0} seenCount={0} />);

    expect(screen.getByText('Total Patients Today')).toBeInTheDocument();
    expect(screen.getByText('In Consultation')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('should calculate counts from todayAppointments when provided', () => {
    const appointments = [
      { id: '1', patientId: 'p1', patientName: 'A', startTime: '09:00', duration: 30, visitType: 'new', status: 'scheduled' as const },
      { id: '2', patientId: 'p2', patientName: 'B', startTime: '10:00', duration: 30, visitType: 'new', status: 'in_progress' as const },
      { id: '3', patientId: 'p3', patientName: 'C', startTime: '11:00', duration: 30, visitType: 'new', status: 'completed' as const },
    ];
    render(<StatusCounters waitingCount={0} seenCount={1} todayAppointments={appointments} />);

    // Total patients today = 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
