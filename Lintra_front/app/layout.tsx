import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { PWARegister } from './pwa-register';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Painel - Lintra Tech',
  description: 'Sistema de CRM interno da Lintra Tech',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon_light.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.png', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  robots: {
    index: false,
    follow: false,
  },
  verification:{
    google: 'Livqowmo0Ajv9D6E0i5wyzParTYzc6r9pS6noxyZ0WE',
  }
};

export const viewport = {
  themeColor: '#F3f4f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased `}>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
