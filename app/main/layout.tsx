'use client';

import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import { CRMProvider } from '@/context/crm-context';
import './main.scss'

export const viewport = {
  themeColor: '#11182b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* HEADER FIXO */}
      <Header />

      {/* CONTEÚDO ABAIXO DO HEADER */}
      <main className="flex flex-1 overflow-hidden min-h-0">
        {/* SIDEBAR */}
        <Sidebar />

        {/* ÁREA DAS PÁGINAS */}
        <div className="flex-1 overflow-hidden min-h-0 p-4 section-content">
          <CRMProvider>{children}</CRMProvider>
        </div>
      </main>
    </div>
  );
}
