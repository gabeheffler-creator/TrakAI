import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, Sun, Moon, Menu, X } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "flex w-48 flex-col fixed inset-y-0 z-50 transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-4 mb-6">
              <TrakLogo />
              <button
                className="sm:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
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
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="sm:pl-48 flex flex-col flex-1">
        {/* Mobile top bar */}
        <div className="sm:hidden sticky top-0 z-30 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-primary text-primary-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <TrakLogo />
        </div>
        <main className="flex-1 focus:outline-none p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
