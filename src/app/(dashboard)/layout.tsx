import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { AppShell } from '@/components/AppShell';
import { validateSession } from '@/lib/services/auth-service';

/**
 * Authenticated dashboard layout.
 * Reads the session cookie, validates the session directly via service layer,
 * and redirects to /login if not authenticated.
 * Renders the AppShell with user context on success.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect('/login');
  }

  try {
    // Validate session directly — no internal fetch needed
    const userInfo = await validateSession(sessionCookie.value);

    const user = {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      role: userInfo.role,
      tenantId: userInfo.tenantId,
    };

    return (
      <AppShell user={user}>
        {children}
      </AppShell>
    );
  } catch {
    redirect('/login');
  }
}
