import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, Menu, X, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { TrakLogo } from "@/components/trak-logo";
import { useListMessages, getListMessagesQueryKey } from "@workspace/api-client-react";

// Detect mobile-frame mode once on load and persist so navigation doesn't lose it
if (typeof window !== "undefined") {
  if (new URLSearchParams(window.location.search).get("mobile") === "1") {
    sessionStorage.setItem("trak_mobile", "1");
  }
}
const IS_MOBILE_FRAME = typeof window !== "undefined" && sessionStorage.getItem("trak_mobile") === "1";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Workout", href: "/workout", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: BookOpen },
  { name: "Progress", href: "/progress", icon: TrendingUp },
  { name: "Nutrition", href: "/nutrition", icon: UtensilsCrossed },
  { name: "Stats", href: "/stats", icon: Ruler },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Photos", href: "/photos", icon: Camera },
  { name: "Tasks", href: "/assignments", icon: ClipboardList },
  { name: "Messages", href: "/messages", icon: MessageCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { clientId } = useClientId();
  const [open, setOpen] = useState(false);

  const { data: messages } = useListMessages(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListMessagesQueryKey(clientId!),
      refetchInterval: 8000,
    },
  });
  const unreadCount = messages?.filter(m => m.sender === "coach" && !m.readAt).length ?? 0;

  if (!clientId) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4">{children}</main>
      </div>
    );
  }

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
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
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
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const showBadge = item.name === "Messages" && unreadCount > 0;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="relative mr-3 flex-shrink-0">
                      <item.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      {showBadge && (
                        <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn("flex flex-col flex-1 w-full min-w-0", IS_MOBILE_FRAME ? "" : "pl-48")}>
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
            {unreadCount > 0 && (
              <Link href="/messages" className="ml-auto">
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </Link>
            )}
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
