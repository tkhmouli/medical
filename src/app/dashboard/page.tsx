import { redirect } from 'next/navigation';

/**
 * /dashboard redirects to / (the actual dashboard is at the root via (dashboard) route group)
 */
export default function DashboardRedirect() {
  redirect('/');
}
