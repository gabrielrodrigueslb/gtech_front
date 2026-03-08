'use client'

import { cn } from '@/lib/utils'
import { useAppShell } from '@/context/app-shell-context'
import type { ReactNode } from 'react'

export default function AppShellContent({ children }: { children: ReactNode }) {
  const { hideMobileNav } = useAppShell()

  return (
    <div
      className={cn(
        'section-content flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 pt-4 md:p-4',
        hideMobileNav
          ? 'pb-[max(1rem,env(safe-area-inset-bottom))]'
          : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'
      )}
    >
      {children}
    </div>
  )
}
