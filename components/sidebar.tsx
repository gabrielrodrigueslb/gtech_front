'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaRegNewspaper, FaTasks, FaWhatsapp } from 'react-icons/fa';
import { FaBuildingUser } from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import { LuLayoutDashboard } from 'react-icons/lu';
import { MdLeaderboard } from 'react-icons/md';
import { TiContacts } from 'react-icons/ti';

type MenuItem = {
  path: string;
  label: string;
  icon: IconType;
};

const MENU_ITEMS: MenuItem[] = [
  { path: '/main/dashboard', label: 'Dashboard', icon: LuLayoutDashboard },
  { path: '/main/contacts', label: 'Contatos', icon: TiContacts },
  { path: '/main/crm', label: 'Negocios', icon: MdLeaderboard },
  { path: '/main/chat', label: 'Chat', icon: FaWhatsapp },
  { path: '/main/clientes', label: 'Clientes', icon: FaBuildingUser },
  { path: '/main/posts', label: 'Posts', icon: FaRegNewspaper },
  { path: '/main/tasks', label: 'Tarefas', icon: FaTasks },
];

export default function Sidebar() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const me = await getMe();

        if (!me) {
          router.push('/');
          return;
        }

        setUser(me);
      } catch {
        router.push('/');
      } finally {
        setLoadingAuth(false);
      }
    }

    checkAuth();
  }, [router]);

  function openSettings() {
    router.push('/main/configuracoes');
  }

  return (
    <aside className="m-3 md:py-10 bg-sidebar-foreground rounded-3xl shadow-lg shrink-0 flex flex-col md:items-center max-md:overflow-scroll">
      <Image
        src="/logo_dark.png"
        width={20}
        height={20}
        className="w-15 pb-10 select-none hidden md:block"
        alt=""
      />

      <nav className="h-full w-20 p-4">
        <ul className="flex flex-col gap-3 items-center">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = mounted && pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  aria-label={item.label}
                  className={`w-full flex items-center bg-sidebar-foreground py-3 px-6 rounded-4xl text-sidebar text-xl ${
                    isActive
                      ? 'bg-sidebar-primary text-white'
                      : 'hover:bg-sidebar-border hover:text-sidebar-primary-foreground'
                  }`}
                >
                  <Icon />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!loadingAuth && user && (
        <div className="user-infos flex items-center gap-4 px-4">
          <button
            type="button"
            title="Abrir configuracoes"
            aria-label="Abrir configuracoes"
            className={`h-12 w-12 rounded-full relative cursor-pointer transition-all ${
              mounted && pathname === '/main/configuracoes'
                ? 'bg-sidebar-primary text-white ring-2 ring-sidebar-primary/30'
                : 'bg-amber-400 text-black hover:scale-105'
            }`}
            onClick={openSettings}
          >
            <span className="flex items-center justify-center h-full font-bold">
              {user.name?.[0]}
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
