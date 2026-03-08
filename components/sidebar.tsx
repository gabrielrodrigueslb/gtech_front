'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAppShell } from '@/context/app-shell-context'
import { getMe } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { FaRegNewspaper, FaTasks, FaWhatsapp } from 'react-icons/fa'
import { FaBuildingUser } from 'react-icons/fa6'
import { FiSettings } from 'react-icons/fi'
import { HiOutlineDotsHorizontal } from 'react-icons/hi'
import type { IconType } from 'react-icons'
import { LuLayoutDashboard } from 'react-icons/lu'
import { MdLeaderboard } from 'react-icons/md'
import { TiContacts } from 'react-icons/ti'

type MenuItem = {
  path: string
  label: string
  icon: IconType
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/main/dashboard', label: 'Dashboard', icon: LuLayoutDashboard },
  { path: '/main/contacts', label: 'Contatos', icon: TiContacts },
  { path: '/main/chat', label: 'Chat', icon: FaWhatsapp },
  { path: '/main/crm', label: 'Negocios', icon: MdLeaderboard },
  { path: '/main/clientes', label: 'Clientes', icon: FaBuildingUser },
  { path: '/main/posts', label: 'Posts', icon: FaRegNewspaper },
  { path: '/main/tasks', label: 'Tarefas', icon: FaTasks },
]

const MOBILE_PRIMARY_PATHS = new Set([
  '/main/dashboard',
  '/main/contacts',
  '/main/chat',
  '/main/crm',
])

const SETTINGS_ITEM: MenuItem = {
  path: '/main/configuracoes',
  label: 'Configuracoes',
  icon: FiSettings,
}

function isMenuActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export default function Sidebar() {
  const { hideMobileNav } = useAppShell()
  const [user, setUser] = useState<any>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function checkAuth() {
      try {
        const me = await getMe()

        if (!me) {
          router.push('/')
          return
        }

        setUser(me)
      } catch {
        router.push('/')
      } finally {
        setLoadingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (hideMobileNav) setIsMoreSheetOpen(false)
  }, [hideMobileNav])

  const primaryMobileItems = useMemo(
    () => MENU_ITEMS.filter((item) => MOBILE_PRIMARY_PATHS.has(item.path)),
    []
  )

  const moreMobileItems = useMemo(
    () => [...MENU_ITEMS.filter((item) => !MOBILE_PRIMARY_PATHS.has(item.path)), SETTINGS_ITEM],
    []
  )

  const isMoreActive =
    mounted && moreMobileItems.some((item) => isMenuActive(pathname, item.path))

  function openSettings() {
    router.push('/main/configuracoes')
  }

  function navigateTo(path: string) {
    setIsMoreSheetOpen(false)
    router.push(path)
  }

  return (
    <>
      <aside className="m-3 hidden shrink-0 flex-col rounded-3xl bg-sidebar-foreground shadow-lg md:flex md:items-center md:py-10">
        <Image
          src="/logo_dark.png"
          width={20}
          height={20}
          className="hidden w-15 select-none pb-10 md:block"
          alt=""
        />

        <nav className="h-full w-20 p-4">
          <ul className="flex flex-col items-center gap-3">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = mounted && isMenuActive(pathname, item.path)

              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    aria-label={item.label}
                    className={`flex w-full items-center rounded-4xl bg-sidebar-foreground px-6 py-3 text-xl text-sidebar ${
                      isActive
                        ? 'bg-sidebar-primary text-white'
                        : 'hover:bg-sidebar-border hover:text-sidebar-primary-foreground'
                    }`}
                  >
                    <Icon />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {!loadingAuth && user && (
          <div className="user-infos flex items-center gap-4 px-4">
            <button
              type="button"
              title="Abrir configuracoes"
              aria-label="Abrir configuracoes"
              className={`relative h-12 w-12 cursor-pointer rounded-full transition-all ${
                mounted && pathname === '/main/configuracoes'
                  ? 'bg-sidebar-primary text-white ring-2 ring-sidebar-primary/30'
                  : 'bg-amber-400 text-black hover:scale-105'
              }`}
              onClick={openSettings}
            >
              <span className="flex h-full items-center justify-center font-bold">
                {user.name?.[0]}
              </span>
            </button>
          </div>
        )}
      </aside>

      {!hideMobileNav && (
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
          <div
            className="w-full rounded-t-[24px] border-t border-white/10 bg-sidebar-foreground/98 px-2.5 pt-1.5 shadow-[0_-14px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            style={{ paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom))' }}
          >
            <nav aria-label="Menu principal mobile">
              <ul className="grid grid-cols-5 items-end gap-0.5">
                {primaryMobileItems.map((item) => {
                  const Icon = item.icon
                  const isActive = mounted && isMenuActive(pathname, item.path)
                  const isChatItem = item.path === '/main/chat'

                  return (
                    <li key={item.path} className="flex justify-center">
                      <Link
                        href={item.path}
                        aria-label={item.label}
                        className={cn(
                          'flex w-full cursor-pointer flex-col items-center justify-end text-[10px] font-medium transition',
                          isChatItem ? 'min-h-[64px] gap-0.5' : 'min-h-[54px] gap-1 rounded-2xl px-1.5 py-1.5'
                        )}
                      >
                        <span
                          className={cn(
                            'flex items-center justify-center transition',
                            isChatItem
                              ? cn(
                                  'mb-0.5 h-[52px] w-[52px] rounded-full border shadow-[0_10px_22px_rgba(0,149,255,0.18)]',
                                  isActive
                                    ? 'border-primary/40 bg-sidebar-primary text-white'
                                    : 'border-white/10 bg-[#1a1b22] text-white/80 hover:bg-white/8'
                                )
                              : cn(
                                  'h-[34px] w-[34px] rounded-2xl',
                                  isActive
                                    ? 'bg-sidebar-primary text-white'
                                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                                )
                          )}
                        >
                          <Icon className={isChatItem ? 'text-[1.15rem]' : 'text-base'} />
                        </span>
                        <span
                          className={cn(
                            'truncate',
                            isActive ? 'text-white' : 'text-white/58',
                            isChatItem && 'font-semibold'
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}

                <li className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsMoreSheetOpen(true)}
                    aria-label="Abrir mais opcoes"
                    className="flex min-h-[54px] w-full cursor-pointer flex-col items-center justify-end gap-1 rounded-2xl px-1.5 py-1.5 text-[10px] font-medium transition"
                  >
                    <span
                      className={cn(
                        'flex h-[34px] w-[34px] items-center justify-center rounded-2xl transition',
                        isMoreActive || isMoreSheetOpen
                          ? 'bg-sidebar-primary text-white'
                          : 'text-white/65 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <HiOutlineDotsHorizontal className="text-base" />
                    </span>
                    <span className={cn(isMoreActive || isMoreSheetOpen ? 'text-white' : 'text-white/58')}>
                      Mais
                    </span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}

      <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[28px] border-white/10 bg-card px-0 pb-8 pt-2"
        >
          <SheetHeader className="border-b border-white/10 px-4 pb-4">
            <SheetTitle>Mais opcoes</SheetTitle>
            <SheetDescription>
              Acesse as outras areas do sistema sem sair da navegacao mobile.
            </SheetDescription>
          </SheetHeader>

          {!loadingAuth && user && (
            <div className="mx-4 mt-4 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/4 px-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 font-bold text-black">
                {user.name?.[0] ?? 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{user.name ?? 'Usuario'}</p>
                <p className="truncate text-xs text-white/50">{user.email ?? ''}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-4">
            {moreMobileItems.map((item) => {
              const Icon = item.icon
              const isActive = mounted && isMenuActive(pathname, item.path)

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-3xl border px-4 py-4 text-left transition',
                    isActive
                      ? 'border-primary/30 bg-primary/12 text-white'
                      : 'border-white/10 bg-white/3 text-white/80 hover:bg-white/6'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg',
                      isActive ? 'bg-primary text-white' : 'bg-white/6 text-white/75'
                    )}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.label}</p>
                    <p className="text-xs text-white/45">Abrir {item.label.toLowerCase()}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
