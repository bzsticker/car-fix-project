"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Car,
  Clock,
  Home,
  LogOut,
  Menu,
  Package,
  Shield,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";

import type { AppRole } from "@/lib/api/rbac";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  role: AppRole;
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const ownerNav = [
    { name: "Overview", href: "/owner", icon: Home },
    { name: "Branches", href: "/owner/branches", icon: Shield },
    { name: "Roster Logs", href: "/owner/roster", icon: Users },
    { name: "Global Stock", href: "/owner/stock", icon: Package },
    { name: "Reports", href: "/owner/reports", icon: BarChart3 },
  ];

  const adminNav = [
    { name: "Dashboard", href: "/branch", icon: Home },
    { name: "Appointments", href: "/branch/appointments", icon: Calendar },
    { name: "Active Jobs", href: "/branch/jobs", icon: Wrench },
    { name: "Customers", href: "/branch/customers", icon: Users },
    { name: "Vehicles", href: "/branch/vehicles", icon: Car },
    { name: "Attendance", href: "/branch/attendance", icon: Clock },
  ];

  const techNav = [{ name: "Active Tasks", href: "/tech", icon: Wrench }];
  const navItems = role === "owner" ? ownerNav : role === "admin" ? adminNav : techNav;

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-white">
          DEN <span className="text-brand-red">MODIFY</span>
        </h1>
        <button onClick={() => setIsOpen((current) => !current)} className="text-white">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden h-20 items-center justify-center border-b border-border px-6 lg:flex">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
            DEN <span className="text-brand-red">MODIFY</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-red/30 bg-brand-red/10 text-brand-red">
            <User size={20} />
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-red">{role}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brand-red text-white shadow-lg shadow-red-950/20"
                    : "text-muted hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} className={isActive ? "text-white" : "text-muted group-hover:text-white"} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted transition-all duration-200 hover:bg-brand-red/10 hover:text-white"
          >
            <LogOut size={18} />
            Logout Shift
          </button>
        </div>
      </div>

      {isOpen ? (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
      ) : null}
    </>
  );
}
