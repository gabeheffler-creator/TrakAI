import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Dumbbell, Activity, Menu, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Exercises", href: "/exercises", icon: Activity },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useDarkMode();

  const DarkModeToggle = () => (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
    >
      {dark ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
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
            <item.icon
              className={cn(
                "mr-3 flex-shrink-0 h-5 w-5",
                isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
              )}
              aria-hidden="true"
            />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-40">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <span className="text-xl font-black tracking-tight text-primary uppercase">TRAK COACH</span>
              </div>
              <nav className="mt-8 flex-1 px-2 space-y-1">
                <NavLinks />
              </nav>
            </div>
            <div className="px-2 pb-4 border-t border-sidebar-border pt-3">
              <DarkModeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="text-xl font-black tracking-tight text-primary uppercase">TRAK COACH</span>
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-2">
              <NavLinks />
            </nav>
          </div>
          <div className="px-2 pb-4 border-t border-sidebar-border pt-3">
            <DarkModeToggle />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1 focus:outline-none p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
