import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/NotificationToast";

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
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
