import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { useDarkMode } from "@/hooks/use-dark-mode";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Workout", href: "/workout", icon: Dumbbell },
  { name: "Progress", href: "/progress", icon: TrendingUp },
  { name: "Stats", href: "/stats", icon: Ruler },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Nutrition", href: "/nutrition", icon: UtensilsCrossed },
  { name: "Photos", href: "/photos", icon: Camera },
  { name: "Tasks", href: "/assignments", icon: ClipboardList },
  { name: "Messages", href: "/messages", icon: MessageCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { clientId } = useClientId();
  const { dark, toggle } = useDarkMode();

  if (!clientId) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <span className="text-lg font-black text-violet-600">tRak</span>
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
                    <item.icon className={cn("mr-3 h-4 w-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          {/* Dark mode toggle */}
          <div className="px-4 pb-5">
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

      {/* Main content */}
      <div className="md:pl-56 flex flex-col flex-1 w-full">
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="grid grid-cols-5 h-16">
          {navigation.slice(0, 5).map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center h-full text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5 mb-0.5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
