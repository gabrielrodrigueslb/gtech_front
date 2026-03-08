'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type AppShellContextValue = {
  hideMobileNav: boolean
  setHideMobileNav: (value: boolean) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [hideMobileNav, setHideMobileNav] = useState(false)

  return (
    <AppShellContext.Provider value={{ hideMobileNav, setHideMobileNav }}>
      {children}
    </AppShellContext.Provider>
  )
}

export function useAppShell() {
  const context = useContext(AppShellContext)
  if (!context) throw new Error('useAppShell must be used within AppShellProvider')
  return context
}
