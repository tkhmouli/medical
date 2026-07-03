import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { validateSession } from '@/lib/services/auth-service';
import { WorkspaceClient } from './components/WorkspaceClient';
import type { Role } from '@/lib/auth/permissions';

/** Roles allowed to access the workspace */
const ALLOWED_ROLES: Role[] = ['Admin', 'Doctor', 'Medical_Assistant'];

/**
 * Workspace page — server component with auth check.
 *
 * - Redirects unauthenticated users to /login
 * - Redirects users without an allowed role to the dashboard
 * - Passes validated user object to WorkspaceClient
 *
 * Requirements: 8.4, 8.5, 8.6
 */
export default async function WorkspacePage() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect('/login');
  }

  let userInfo: {
    id: string;
    name: string;
    email: string;
    role: Role;
    tenantId: string;
  };

  try {
    userInfo = await validateSession(sessionCookie.value);
  } catch {
    redirect('/login');
  }

  // Redirect non-allowed roles to the main dashboard
  if (!ALLOWED_ROLES.includes(userInfo.role)) {
    redirect('/');
  }

  const user = {
    id: userInfo.id,
    name: userInfo.name,
    email: userInfo.email,
    role: userInfo.role,
    tenantId: userInfo.tenantId,
  };

  return <WorkspaceClient user={user} />;
}
