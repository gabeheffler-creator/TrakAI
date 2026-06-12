import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, MessageCircle, Settings } from "lucide-react";
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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: unread } = useGetCoachUnreadCount({
    query: { queryKey: getGetCoachUnreadCountQueryKey(), refetchInterval: 8000 },
  });
  const totalUnread = unread?.total ?? 0;

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
