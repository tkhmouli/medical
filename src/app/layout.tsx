import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/NotificationToast";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Clinic SaaS Platform",
  description: "Multi-tenant clinic management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className="min-h-screen antialiased theme-bg-primary theme-text-primary">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
