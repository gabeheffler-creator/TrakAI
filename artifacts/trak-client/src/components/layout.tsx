import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, Sun, Menu, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TrakLogo } from "@/components/trak-logo";
import { useListMessages, getListMessagesQueryKey } from "@workspace/api-client-react";

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
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { clientId } = useClientId();
  const { dark, toggle } = useDarkMode();
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
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "flex w-48 flex-col fixed inset-y-0 z-50 transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
      )}>
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-4 mb-6">
              <TrakLogo />
              <button
                className="sm:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
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
        {/* Mobile top bar — hidden on desktop */}
        <div className="sm:hidden sticky top-0 z-30 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
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
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
