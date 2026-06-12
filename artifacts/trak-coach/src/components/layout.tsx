import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, MessageCircle, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrakLogo } from "./trak-logo";
import { useGetCoachUnreadCount, getGetCoachUnreadCountQueryKey } from "@workspace/api-client-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: Activity },
  { name: "Messages", href: "/messages", icon: MessageCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

function isMobileFrame() {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("mobile") === "1") {
    sessionStorage.setItem("trak_coach_mobile_frame", "1");
    return true;
  }
  return sessionStorage.getItem("trak_coach_mobile_frame") === "1";
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobile] = useState(() => isMobileFrame());

  const { data: unread } = useGetCoachUnreadCount({
    query: { queryKey: getGetCoachUnreadCountQueryKey(), refetchInterval: 8000 },
  });
  const totalUnread = unread?.total ?? 0;

  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  if (mobile) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-background">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
          <TrakLogo />
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative w-64 bg-sidebar flex flex-col py-5 shadow-xl h-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 mb-6">
                <TrakLogo />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 mr-3 flex-shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                      {item.name}
                      {item.name === "Messages" && totalUnread > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main content — full width on mobile */}
        <main className="flex-1 p-4 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Permanent sidebar — always visible on web */}
      <div className="flex w-48 flex-col fixed inset-y-0 z-50">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <TrakLogo />
            </div>
            <nav className="flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="relative mr-3 flex-shrink-0">
                      <item.icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content — offset by sidebar width */}
      <div className="flex flex-col flex-1 pl-48">
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
