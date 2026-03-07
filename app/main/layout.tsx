import Sidebar from '@/components/sidebar'
import { CRMProvider } from '@/context/crm-context'
import { FunnelProvider } from '@/context/funnel-context'

export const viewport = {
  themeColor: '#11182b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden animate-in transition-opacity duration-300 ease-in-out md:flex-row">
      <main className="flex min-h-0 min-w-0 flex-1">
        <FunnelProvider>
          <Sidebar />

          <div className="section-content flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-4">
            <CRMProvider>{children}</CRMProvider>
          </div>
        </FunnelProvider>
      </main>
    </div>
  )
}
