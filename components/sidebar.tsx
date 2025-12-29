'use client';
import { MdLeaderboard } from 'react-icons/md';
import { TiContacts } from 'react-icons/ti';
import { LuLayoutDashboard } from "react-icons/lu";
import { FaBuildingUser } from "react-icons/fa6";
import { FaTasks } from "react-icons/fa";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar() {
const pathname = usePathname()

console.log(pathname)

  const menuItems = [
    { id:1, path: '/main/dashboard', label: 'Dashboard', icon: <LuLayoutDashboard /> },
    { id:2, path: '/main/contacts', label: 'Contatos', icon: <TiContacts /> },
    { id:3, path: '/main/crm', label: 'Negócios', icon: <MdLeaderboard /> },
    { id:4, path: '/main/clientes', label: 'Clientes', icon: <FaBuildingUser /> },
    { id:5, path: '/main/tasks', label: 'Tarefas', icon: <FaTasks /> }
  ];

  return (
    <aside className=" flex flex-col gap-2 justify-center navbar">
      <nav className="flex-1 sm:p-3 p-2 ">
        <ul className="flex flex-row sm:flex-col gap-2 justify-between">

          {menuItems.map((item) => (
            <li key={item.id}>
              <Link href={item.path}
                className={`sidebar-link w-full flex items-center ${
                  pathname == item.path ? 'active' : ''
                }`}
              >
                <span  className="text-xl flex justify-center items-center">
                  {item.icon}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
