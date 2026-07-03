import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { validateSession } from '@/lib/services/auth-service';
import { getDashboardStats } from '@/lib/services/dashboard-service';
import DashboardClient from './components/DashboardClient';

/**
 * Dashboard home page (Server Component).
 * Fetches session and loads initial dashboard stats server-side
 * to avoid a loading spinner on first render.
 *
 * Requirements: 2.1, 3.1, 11.3
 */
export default async function DashboardPage() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect('/login');
  }

  let userInfo;
  try {
    userInfo = await validateSession(sessionCookie.value);
  } catch {
    redirect('/login');
  }

  const today = new Date().toISOString().split('T')[0];
  const doctorId = userInfo.role === 'Doctor' ? userInfo.id : null;
  const initialStats = await getDashboardStats(
    userInfo.tenantId,
    doctorId,
    today
  );

  return (
    <DashboardClient
      user={{
        userId: userInfo.id,
        role: userInfo.role,
        name: userInfo.name,
      }}
      initialStats={initialStats}
    />
  );
}
