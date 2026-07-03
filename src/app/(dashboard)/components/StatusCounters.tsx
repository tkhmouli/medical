'use client';

/**
 * StatusCounters displays real-time waiting room and patients seen counters.
 * Used on the doctor dashboard to show at-a-glance patient flow status.
 *
 * Requirements: 5.1, 6.1
 */

interface StatusCountersProps {
  waitingCount: number;
  seenCount: number;
}

export default function StatusCounters({ waitingCount, seenCount }: StatusCountersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Waiting Room Counter */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-medium text-amber-700">Waiting Room</p>
        <p className="mt-2 text-3xl font-bold text-amber-900">{waitingCount}</p>
        <p className="mt-1 text-xs text-amber-600">
          {waitingCount === 1 ? 'patient waiting' : 'patients waiting'}
        </p>
      </div>

      {/* Patients Seen Counter */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <p className="text-sm font-medium text-green-700">Patients Seen</p>
        <p className="mt-2 text-3xl font-bold text-green-900">{seenCount}</p>
        <p className="mt-1 text-xs text-green-600">
          {seenCount === 1 ? 'patient seen today' : 'patients seen today'}
        </p>
      </div>
    </div>
  );
}
