import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, ClipboardList, MessageCircle, TrendingUp, BookOpen, Settings, Menu, X, ShieldOff, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { TrakLogo } from "@/components/trak-logo";
import { LogoutButton } from "@/App";
import { useListMessages, getListMessagesQueryKey } from "@workspace/api-client-react";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Workout", href: "/workout", icon: Dumbbell },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Exercises", href: "/exercises", icon: BookOpen },
  { name: "Nutrition", href: "/nutrition", icon: UtensilsCrossed },
  { name: "Stats", href: "/stats", icon: TrendingUp },
  { name: "Sleep", href: "/sleep", icon: Moon },

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
      {navigation.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNav}
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <span className="relative mr-3 flex-shrink-0">
              <item.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
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
  const { clientId, isDeactivated } = useClientId();

  const { data: messages } = useListMessages(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListMessagesQueryKey(clientId!),
      refetchInterval: 8000,
    },
  });
  const unreadCount = messages?.filter(m => m.sender === "coach" && !m.readAt).length ?? 0;

  const [location] = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location]);

  if (isDeactivated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Account paused</h1>
          <p className="text-sm text-muted-foreground">
            Your coach has paused your access to Trak. Reach out to them directly if you'd
            like to reenroll — your progress and history are safe and waiting for you.
          </p>
          <LogoutButton className="mx-auto" />
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4">{children}</main>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-4 mb-6">
        <TrakLogo />
      </div>
      <nav className="flex-1 px-3 space-y-1">
        <NavLinks unread={unreadCount} onNav={() => setDrawerOpen(false)} />
      </nav>
      <div className="px-3 pt-2 border-t border-sidebar-border">
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
            {!drawerOpen && unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
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
      <div className="flex flex-col flex-1 w-full min-w-0 pl-48">
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
