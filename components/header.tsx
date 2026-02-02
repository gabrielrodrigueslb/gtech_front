'use client'

import { getMe } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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
    <header className="flex justify-between p-4 items-center">
            <div className="px-4">
              <div className="flex items-center justify-center">
                <div className="w-20 h-auto flex ">
                  <img
                    className="w-full h-auto"
                    src="/logo_dark.png"
                    alt="logo lintra"
                  />
                </div>
              </div>
            </div>
            
          </header>
  )
}
