import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/content", label: "Content" },
  { href: "/batches", label: "Batches" },
  { href: "/social", label: "Social" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex h-11 items-center justify-between">
            <Link href="/" className="text-sm font-semibold text-foreground tracking-tight" data-testid="logo-link">
              The Italian Exit
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5" data-testid="desktop-nav">
              {navItems.map((item) => {
                const isActive = location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-2.5 py-1 rounded text-sm transition-colors",
                      isActive
                        ? "text-foreground font-medium bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: logout + mobile menu */}
            <div className="flex items-center gap-1">
              <button
                className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={logout}
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
              <button
                className="md:hidden p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t px-4 py-1.5 space-y-0.5" data-testid="mobile-nav">
            {navItems.map((item) => {
              const isActive = location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-2.5 py-1.5 rounded text-sm transition-colors",
                    isActive
                      ? "text-foreground font-medium bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mt-1 border-t pt-2"
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              data-testid="button-logout-mobile"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        {children}
      </main>
    </div>
  );
}
