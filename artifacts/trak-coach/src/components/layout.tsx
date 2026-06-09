import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, MessageCircle, Sun, Moon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TrakLogo } from "./trak-logo";
import { useGetCoachUnreadCount, getGetCoachUnreadCountQueryKey } from "@workspace/api-client-react";

// Detect mobile-frame mode once on load and persist so navigation doesn't lose it
if (typeof window !== "undefined") {
  if (new URLSearchParams(window.location.search).get("mobile") === "1") {
    sessionStorage.setItem("trak_mobile", "1");
  }
}
const IS_MOBILE_FRAME = typeof window !== "undefined" && sessionStorage.getItem("trak_mobile") === "1";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: Activity },
  { name: "Messages", href: "/messages", icon: MessageCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useDarkMode();
  const [open, setOpen] = useState(false);

  const { data: unread } = useGetCoachUnreadCount({
    query: { queryKey: getGetCoachUnreadCountQueryKey(), refetchInterval: 8000 },
  });
  const totalUnread = unread?.total ?? 0;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile backdrop — only in mobile frame */}
      {IS_MOBILE_FRAME && open && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "flex w-48 flex-col fixed inset-y-0 z-50",
        IS_MOBILE_FRAME
          ? cn("transition-transform duration-200 ease-in-out", open ? "translate-x-0" : "-translate-x-full")
          : "translate-x-0"
      )}>
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-4 mb-6">
              <TrakLogo />
              {IS_MOBILE_FRAME && (
                <button
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <nav className="flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const showBadge = item.name === "Messages" && totalUnread > 0;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="relative mr-3 flex-shrink-0">
                      <item.icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                      {showBadge && (
                        <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                    </span>
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
      <div className={cn("flex flex-col flex-1", IS_MOBILE_FRAME ? "" : "pl-48")}>
        {/* Top bar — only in mobile frame */}
        {IS_MOBILE_FRAME && (
          <div className="sticky top-0 z-30 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
            <button
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg bg-primary text-primary-foreground"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <TrakLogo />
            {totalUnread > 0 && (
              <Link href="/messages" className="ml-auto">
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              </Link>
            )}
          </div>
        )}
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
