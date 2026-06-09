import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, Sun, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TrakLogo } from "@/components/trak-logo";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Workout", href: "/workout", icon: Dumbbell },
  { name: "Progress", href: "/progress", icon: TrendingUp },
  { name: "Nutrition", href: "/nutrition", icon: UtensilsCrossed },
  { name: "Stats", href: "/stats", icon: Ruler },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Photos", href: "/photos", icon: Camera },
  { name: "Tasks", href: "/assignments", icon: ClipboardList },
  { name: "Messages", href: "/messages", icon: MessageCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { clientId } = useClientId();
  const { dark, toggle } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!clientId) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4">{children}</main>
      </div>
    );
  }

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
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-4 mb-6">
              <TrakLogo />
              <button
                className="sm:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("mr-3 h-4 w-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 pb-2 pt-4">
              <button
                onClick={toggle}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                {dark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                {dark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="sm:pl-48 flex flex-col flex-1 w-full min-w-0">
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
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
