import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppointmentList from './AppointmentList';
import type { DashboardAppointment } from '@/lib/services/dashboard-service';

// ─── Test Data ────────────────────────────────────────────────────────────────

const mockAppointments: DashboardAppointment[] = [
  {
    id: '1',
    patientName: 'Alice Johnson',
    startTime: '09:00',
    duration: 30,
    visitType: 'Follow-up',
    status: 'scheduled',
  },
  {
    id: '2',
    patientName: 'Bob Smith',
    startTime: '10:30',
    duration: 45,
    visitType: 'New Visit',
    status: 'waiting',
  },
  {
    id: '3',
    patientName: 'Carol White',
    startTime: '14:00',
    duration: 60,
    visitType: 'Consultation',
    status: 'completed',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppointmentList', () => {
  describe('empty state', () => {
    it('should display the empty message when no appointments exist', () => {
      render(
        <AppointmentList
          appointments={[]}
          emptyMessage="No appointments scheduled for today."
        />
      );

      expect(screen.getByText('No appointments scheduled for today.')).toBeInTheDocument();
    });

    it('should display custom empty message for tomorrow', () => {
      render(
        <AppointmentList
          appointments={[]}
          emptyMessage="No appointments scheduled for tomorrow."
        />
      );

      expect(screen.getByText('No appointments scheduled for tomorrow.')).toBeInTheDocument();
    });
  });

  describe('appointment rendering', () => {
    it('should render patient names for all appointments', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Carol White')).toBeInTheDocument();
    });

    it('should render start time, duration, and visit type for each appointment', () => {
      render(
        <AppointmentList
          appointments={[mockAppointments[0]]}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByText(/09:00/)).toBeInTheDocument();
      expect(screen.getByText(/30 min/)).toBeInTheDocument();
      expect(screen.getByText(/Follow-up/)).toBeInTheDocument();
    });

    it('should format duration over 60 minutes correctly', () => {
      render(
        <AppointmentList
          appointments={[mockAppointments[2]]}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByText(/1h/)).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('should not show status badge when showStatus is false', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          showStatus={false}
          emptyMessage="No appointments."
        />
      );

      expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
      expect(screen.queryByText('Waiting')).not.toBeInTheDocument();
      expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    });

    it('should not show status badge by default (showStatus omitted)', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          emptyMessage="No appointments."
        />
      );

      expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
      expect(screen.queryByText('Waiting')).not.toBeInTheDocument();
    });

    it('should show status badges when showStatus is true', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          showStatus={true}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Waiting')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render In Progress status badge correctly', () => {
      const inProgressAppointment: DashboardAppointment = {
        id: '4',
        patientName: 'Dave Brown',
        startTime: '11:00',
        duration: 30,
        visitType: 'Check-up',
        status: 'in_progress',
      };

      render(
        <AppointmentList
          appointments={[inProgressAppointment]}
          showStatus={true}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  describe('list structure', () => {
    it('should render a list element with role="list"', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          emptyMessage="No appointments."
        />
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should render the correct number of list items', () => {
      render(
        <AppointmentList
          appointments={mockAppointments}
          emptyMessage="No appointments."
        />
      );

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });
  });
});
