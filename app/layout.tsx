import type { Metadata } from 'next';
import { ClientOnly } from '@/components/client-only';
import './globals.css';

export const metadata: Metadata = {
  title: 'Publishing ERP | Enterprise Workspace',
  description: 'Enterprise publishing operations platform',
};

const SUPPRESS_EXTENSION_HYDRATION_SCRIPT = `
  (function() {
    if (typeof window === 'undefined') return;
    const origError = console.error;
    console.error = function(...args) {
      const msg = args.map(a => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
      if (
        msg.includes('bis_skin_checked') ||
        msg.includes('hydration') ||
        msg.includes('hydrated')
      ) {
        return;
      }
      origError.apply(console, args);
    };
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: SUPPRESS_EXTENSION_HYDRATION_SCRIPT }}
        />
      </head>
      <body suppressHydrationWarning>
        <ClientOnly>{children}</ClientOnly>
      </body>
    </html>
  );
}
