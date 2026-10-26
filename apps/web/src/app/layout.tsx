import type { Metadata, Viewport } from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/shell/service-worker';
import { SiteFooter } from '@/components/shell/site-footer';
import { SiteHeader } from '@/components/shell/site-header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ballistic Forge — precision ballistics',
    template: '%s · Ballistic Forge',
  },
  description:
    'A brand-agnostic precision ballistics solver with real atmospherics, wind, spin drift and Coriolis — plus a suppressor module and crowdsourced field data.',
  applicationName: 'Ballistic Forge',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Ballistic Forge',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  // Firearm owners are privacy-sensitive; keep the pilot out of search indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#1C1C2E',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available: never trap a user who needs larger text.
  maximumScale: 5,
};

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <html lang="en" className={`${inter.variable} ${sourceCodePro.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-forge-500 focus:px-4 focus:py-2 focus:text-gunmetal-950"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
