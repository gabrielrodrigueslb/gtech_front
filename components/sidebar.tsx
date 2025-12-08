'use client';
import { MdLeaderboard } from 'react-icons/md';
import { TiContacts } from 'react-icons/ti';
import { LuLayoutDashboard } from "react-icons/lu";
import { GoGraph } from "react-icons/go";
import { FaTasks } from "react-icons/fa";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LuLayoutDashboard /> },
    { id: 'contacts', label: 'Contatos', icon: <TiContacts /> },
    { id: 'deals', label: 'Negócios', icon: <MdLeaderboard /> },
    { id: 'tasks', label: 'Tarefas', icon: <FaTasks /> },
    { id: 'analytics', label: 'Relatórios', icon: <GoGraph /> },
  ];

  return (
    <aside className=" flex flex-col gap-2 justify-center navbar">
      <nav className="flex-1 sm:p-3 p-1">
        <ul className="flex flex-row sm:flex-col gap-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-link w-full flex items-center ${
                  activeTab === item.id ? 'active' : ''
                }`}
              >
                <span className="text-xl flex justify-center items-center">
                  {item.icon}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
