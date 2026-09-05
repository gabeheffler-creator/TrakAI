import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, MessageCircle, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrakLogo } from "./trak-logo";
import { LogoutButton } from "@/App";
import { useGetCoachUnreadCount, getGetCoachUnreadCountQueryKey } from "@workspace/api-client-react";
import { playTick } from "@/lib/sounds";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: Activity },
  { name: "Messages", href: "/messages", icon: MessageCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function NavLinks({ unread, onNav }: { unread: number; onNav?: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {navItems.map((item) => {
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
            <span className="relative mr-3 flex-shrink-0">
              <item.icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
            </span>
            {item.name}
            {item.name === "Messages" && unread > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: unread } = useGetCoachUnreadCount({
    query: { queryKey: getGetCoachUnreadCountQueryKey(), refetchInterval: 8000 },
  });
  const totalUnread = unread?.total ?? 0;

  // Close drawer on route change
  const [location] = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location]);

  const sidebarContent = (
    <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-4 mb-6">
        <TrakLogo />
      </div>
      <nav className="flex-1 px-2 space-y-1">
        <NavLinks
          unread={totalUnread}
          onNav={() => {
            playTick();
            setDrawerOpen(false);
          }}
        />
      </nav>
      <div className="px-2 pt-2 border-t border-sidebar-border">
        <LogoutButton className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground" />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
          <TrakLogo />
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="p-1.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative"
            aria-label="Toggle menu"
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {!drawerOpen && totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        </div>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="fixed top-0 left-0 h-full w-56 z-50 bg-sidebar border-r border-sidebar-border shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
              {sidebarContent}
            </div>
          </>
        )}

        <main className="flex-1 p-4 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Permanent sidebar — desktop */}
      <div className="flex w-48 flex-col fixed inset-y-0 z-50">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          {sidebarContent}
        </div>
      </div>
      <div className="flex flex-col flex-1 pl-48">
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
