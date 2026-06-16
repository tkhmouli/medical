/**
 * Dashboard home page.
 * Displays a welcome message with the user's name.
 * This page is rendered within the authenticated AppShell layout.
 */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Dashboard
      </h1>
      <p className="mt-2 text-gray-600">
        Welcome to your clinic management platform.
      </p>
    </div>
  );
}
