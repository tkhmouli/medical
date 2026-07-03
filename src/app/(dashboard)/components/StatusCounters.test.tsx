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

  it('should render patients seen counter with correct count', () => {
    render(<StatusCounters waitingCount={3} seenCount={5} />);

    expect(screen.getByText('Patients Seen')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show singular label when count is 1', () => {
    render(<StatusCounters waitingCount={1} seenCount={1} />);

    expect(screen.getByText('patient waiting')).toBeInTheDocument();
    expect(screen.getByText('patient seen today')).toBeInTheDocument();
  });

  it('should show plural label when count is 0', () => {
    render(<StatusCounters waitingCount={0} seenCount={0} />);

    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(2);
    expect(screen.getByText('patients waiting')).toBeInTheDocument();
    expect(screen.getByText('patients seen today')).toBeInTheDocument();
  });

  it('should show plural label when count is greater than 1', () => {
    render(<StatusCounters waitingCount={7} seenCount={12} />);

    expect(screen.getByText('patients waiting')).toBeInTheDocument();
    expect(screen.getByText('patients seen today')).toBeInTheDocument();
  });
});
