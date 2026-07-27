"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  FileText,
  ClipboardList,
  Briefcase,
  Zap,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Zap },
  { href: "/tracker", label: "Tracker", icon: ClipboardList },
  { href: "/jobs", label: "Live Feed", icon: Search },
  { href: "/resume", label: "Resume", icon: FileText },
];

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="h-full flex">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col min-h-screen flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Job Application</h1>
              <p className="text-xs text-gray-400">Assistant</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="text-xs text-gray-500">
            Brijesh M Patil
            <br />
            Frontend Engineer
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold">Job Application</span>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around border-t bg-white pt-2 pb-[env(safe-area-inset-bottom,8px)] sticky bottom-0 z-30">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs ${
                  isActive
                    ? "text-indigo-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-72 bg-gray-900 text-white flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Job Application</h2>
                  <p className="text-xs text-gray-400">Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="px-5 py-4 border-t border-gray-800">
              <div className="text-xs text-gray-500">
                Brijesh M Patil
                <br />
                Frontend Engineer
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
