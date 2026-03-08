import Sidebar from '@/components/sidebar'
import AppShellContent from '@/components/app-shell-content'
import { CRMProvider } from '@/context/crm-context'
import { FunnelProvider } from '@/context/funnel-context'
import { AppShellProvider } from '@/context/app-shell-context'

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
          <AppShellProvider>
            <Sidebar />

            <AppShellContent>
              <CRMProvider>{children}</CRMProvider>
            </AppShellContent>
          </AppShellProvider>
        </FunnelProvider>
      </main>
    </div>
  )
}
