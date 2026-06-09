import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, Sun, Moon, AlignJustify } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TrakLogo } from "./trak-logo";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: Activity },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useDarkMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 px-2 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNav}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("mr-3 flex-shrink-0 h-5 w-5", isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 pb-4 border-t border-sidebar-border pt-3">
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
        >
          {dark ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile hamburger — purple square */}
      <button
        onClick={() => setDrawerOpen((o) => !o)}
        className="md:hidden fixed top-4 left-4 z-[60] flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground shadow-md"
        aria-label="Toggle menu"
      >
        <AlignJustify className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative flex flex-col w-64 bg-sidebar border-r border-sidebar-border shadow-xl z-50 animate-in slide-in-from-left duration-200">
            <div className="flex items-center px-4 pt-5 pb-4">
              <TrakLogo />
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto mt-4">
              <NavContent onNav={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <TrakLogo />
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-2">
              <NavContent />
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1 focus:outline-none p-4 pt-16 md:pt-8 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
