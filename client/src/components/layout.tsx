import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav — logo + sign out only */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex h-11 items-center justify-between">
            <span className="text-sm font-semibold text-foreground tracking-tight" data-testid="logo">
              The Italian Exit
            </span>
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        {children}
      </main>
    </div>
  );
}
