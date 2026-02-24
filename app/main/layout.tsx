import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import WhatsAppGlobalAlerts from '@/components/whatsapp-global-alerts';
import { CRMProvider } from '@/context/crm-context';
import { FunnelProvider } from '@/context/funnel-context';

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
    <div
      className="h-screen flex-col-reverse md:flex-row flex w-screen overflow-hidden animate-in transition-opacity
        duration-300 ease-in-out"
    >

      {/* CONTEÃšDO ABAIXO DO HEADER */}
      <main className="flex flex-1 min-h-0 min-w-0">
        <FunnelProvider>
          {/* SIDEBAR */}
          <Sidebar />

          {/* ÃREA DAS PÃGINAS */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-4 section-content">
            <CRMProvider>
              {children}
              <WhatsAppGlobalAlerts />
            </CRMProvider>
          </div>
        </FunnelProvider>
      </main>
    </div>
  );
}
