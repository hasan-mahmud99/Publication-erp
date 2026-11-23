import type { Metadata } from 'next';
import { ClientOnly } from '@/components/client-only';
import './globals.css';

export const metadata: Metadata = {
  title: 'Publishing ERP | Enterprise Workspace',
  description: 'Enterprise publishing operations platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientOnly>{children}</ClientOnly>
      </body>
    </html>
  );
}
