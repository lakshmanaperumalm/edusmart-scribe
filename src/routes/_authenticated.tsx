import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BookOpen, Target, MessageSquare, CalendarRange, BarChart3, GraduationCap, Shield, LogOut, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({ component: AppLayout });

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notes", label: "AI Notes", icon: BookOpen },
  { to: "/quiz", label: "Quizzes", icon: Target },
  { to: "/plan", label: "Study Plan", icon: CalendarRange },
  { to: "/chat", label: "Doubt Tutor", icon: MessageSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

function AppLayout() {
  const { user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const isTeacher = roles.includes("teacher") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/dashboard" className="mb-6 px-2"><Logo /></Link>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {isTeacher && (
            <Link to="/teacher" className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", path.startsWith("/teacher") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent")}>
              <GraduationCap className="h-4 w-4" /> Teacher
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", path.startsWith("/admin") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent")}>
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
