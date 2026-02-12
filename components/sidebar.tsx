'use client';
import Image from 'next/image';
import { getMe } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MdLeaderboard } from 'react-icons/md';
import { TiContacts } from 'react-icons/ti';
import { LuLayoutDashboard } from "react-icons/lu";
import { FaBuildingUser } from "react-icons/fa6";
import { FaTasks , FaRegNewspaper} from "react-icons/fa";
import Link from 'next/link';

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const pathname = usePathname();
  const menuItems = [
    { id:1, path: '/main/dashboard', label: 'Dashboard', icon: <LuLayoutDashboard /> },
    { id:2, path: '/main/contacts', label: 'Contatos', icon: <TiContacts /> },
    { id:3, path: '/main/crm', label: 'Negócios', icon: <MdLeaderboard /> },
    { id:4, path: '/main/clientes', label: 'Clientes', icon: <FaBuildingUser /> },
    { id:7, path: '/main/posts', label: 'Posts', icon: <FaRegNewspaper /> },
    { id:5, path: '/main/tasks', label: 'Tarefas', icon: <FaTasks /> },
  ];

  const router = useRouter();

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

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    router.replace('/');
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const menuRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <aside className="m-3 md:py-10 bg-sidebar-foreground rounded-3xl shadow-lg shrink-0 flex flex-col md:items-center max-md:overflow-scroll">
      <Image src="/logo_dark.png" width={20} quality={100} height={20} className='w-15 pb-10 select-none hidden md:block' alt="" />
      <nav className=" h-full w-24  p-4">
        <ul className=" flex flex-row md:flex-col gap-3 items-center">
          {menuItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.path}
                className={` w-full flex items-center bg-sidebar-foreground py-4 px-7 rounded-4xl text-sidebar text-2xl ${
                  pathname == item.path ? 'bg-sidebar-primary  text-white' : 'hover:bg-sidebar-border hover:text-sidebar-primary-foreground'
                }`}
              >
                  {item.icon}
              </Link>
            </li>
          ))}
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
                menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              } transition-opacity duration-100`}
            >
              <ul className="w-full flex flex-col justify-center items-center">
                <li className="py-4 cursor-pointer w-full text-center profile-menu-link">
                  Perfil
                </li>
                <li className="py-4 cursor-pointer w-full profile-menu-link text-center">
                  Configurações
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
