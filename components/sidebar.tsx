'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  { path: '/main/chat2', label: 'Chat 2', icon: FaWhatsapp },
  { path: '/main/posts', label: 'Posts', icon: FaRegNewspaper },
  { path: '/main/tasks', label: 'Tarefas', icon: FaTasks },
];

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    router.replace('/');
  }

  function toggleMenu() {
    setMenuOpen((current) => !current);
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
          <div
            className="h-12 w-12 bg-amber-400 rounded-full relative cursor-pointer"
            onClick={toggleMenu}
            ref={menuRef}
          >
            <span className="flex items-center justify-center h-full font-bold">
              {user.name?.[0]}
            </span>

            <div
              className={`profile-menu w-55 rounded-2xl bg-background absolute bottom-0 z-50 shadow-lg overflow-hidden border border-border ${
                menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } transition-opacity duration-100`}
            >
              <ul className="w-full flex flex-col justify-center items-center">
                <li className="py-4 cursor-pointer w-full text-center profile-menu-link">
                  Perfil
                </li>
                <li className="py-4 cursor-pointer w-full profile-menu-link text-center">
                  Configuracoes
                </li>
                <li
                  className="py-4 cursor-pointer w-full profile-menu-link text-center"
                  onClick={handleLogout}
                >
                  Sair
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
