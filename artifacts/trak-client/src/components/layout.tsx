import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
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
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { clientId } = useClientId();

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
      {/* Permanent sidebar — always visible */}
      <div className="flex w-48 flex-col fixed inset-y-0 z-50">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <TrakLogo />
            </div>
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
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
                    {item.name === "Messages" && unreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content — offset by sidebar width */}
      <div className="flex flex-col flex-1 w-full min-w-0 pl-48">
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
