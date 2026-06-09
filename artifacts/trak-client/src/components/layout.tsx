import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Ruler, Moon, UtensilsCrossed, Camera, ClipboardList, MessageCircle, TrendingUp, Sun, X, AlignJustify } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientId } from "@/hooks/use-client-id";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TrakLogo } from "@/components/trak-logo";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Workout", href: "/workout", icon: Dumbbell },
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!clientId) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <main className="flex-1 p-4">{children}</main>
      </div>
    );
  }

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 px-3 space-y-1">
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
              <item.icon className={cn("mr-3 h-4 w-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-5">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {dark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile hamburger — purple square button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground shadow-md"
        aria-label="Open menu"
      >
        <AlignJustify className="h-5 w-5" />
      </button>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative flex flex-col w-64 bg-sidebar border-r border-sidebar-border shadow-xl z-50 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-4 pt-6 pb-4">
              <TrakLogo />
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto pb-4">
              <NavContent onNav={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:flex w-56 flex-col fixed inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <TrakLogo />
            </div>
            <NavContent />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-56 flex flex-col flex-1 w-full min-w-0">
        <main className="flex-1 p-4 pt-16 md:pt-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
