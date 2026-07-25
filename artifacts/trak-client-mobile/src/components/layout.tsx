import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Dumbbell, Moon, UtensilsCrossed, MessageCircle,
  TrendingUp, BookOpen, Settings, Menu, X, CalendarDays, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { TrakLogo } from "@/components/trak-logo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  useListMessages, getListMessagesQueryKey,
  useListSleepLogs, getListSleepLogsQueryKey,
  useListNutritionLogs, getListNutritionLogsQueryKey,
} from "@workspace/api-client-react";

const navigation = [
  { name: "Home",      href: "/",           icon: Home },
  { name: "Workout",   href: "/workout",    icon: Dumbbell },
  { name: "Calendar",  href: "/calendar",   icon: CalendarDays },
  { name: "Exercises", href: "/exercises",  icon: BookOpen },
  { name: "Nutrition", href: "/nutrition",  icon: UtensilsCrossed },
  { name: "Stats",     href: "/stats",      icon: TrendingUp },
  { name: "Sleep",     href: "/sleep",      icon: Moon },
  { name: "Messages",  href: "/messages",   icon: MessageCircle },
  { name: "Tasks",     href: "/tasks",      icon: ClipboardList },
  { name: "Settings",  href: "/settings",   icon: Settings },
];

function LogoutButton({ className }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <Button type="button" variant="ghost" size="sm" className={className} onClick={logout}>
      Log out
    </Button>
  );
}

function NavLinks({
  unread,
  calendarDot,
  onNav,
}: {
  unread: number;
  calendarDot: boolean;
  onNav?: () => void;
}) {
  const [location] = useLocation();
  return (
    <>
      {navigation.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
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
              <item.icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
              />
              {item.name === "Calendar" && calendarDot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { clientId } = useClientId();
  const [location] = useLocation();

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [location]);

  const { data: messages } = useListMessages(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListMessagesQueryKey(clientId!),
      refetchInterval: 8000,
    },
  });
  const unreadCount =
    messages?.filter((m) => m.sender === "coach" && !m.readAt).length ?? 0;

  const todayISO = new Date().toISOString().split("T")[0];
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!), staleTime: 60_000 },
  });
  const { data: nutritionLogs } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!), staleTime: 60_000 },
  });
  const hasTodaySleep = (sleepLogs ?? []).some((l) => l.date === todayISO);
  const hasTodayNutrition = (nutritionLogs ?? []).some(
    (l) => l.date === todayISO && l.imageUrl !== "water_only"
  );
  const calendarDot =
    !!clientId &&
    !!(sleepLogs !== undefined || nutritionLogs !== undefined) &&
    (!hasTodaySleep || !hasTodayNutrition);

  const sidebarContent = (
    <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-4 mb-5">
        <TrakLogo />
      </div>
      <nav className="flex-1 px-3 space-y-1">
        <NavLinks
          unread={unreadCount}
          calendarDot={calendarDot}
          onNav={() => setDrawerOpen(false)}
        />
      </nav>
      <div className="px-3 pt-2 border-t border-sidebar-border">
        <LogoutButton className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
        <TrakLogo />
        <button
          onClick={() => setDrawerOpen((v) => !v)}
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

      {/* Drawer overlay — fixed to viewport, covers full screen */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed top-0 left-0 h-full w-56 z-50 bg-sidebar border-r border-sidebar-border shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-y-auto phone-scroll">
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}
