import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  BookMarked,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Route as RouteIcon,
  ShieldCheck,
  Timer,
  User,
  X,
  Youtube,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OfflineBanner } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/roadmap", label: "Roadmap", icon: RouteIcon },
  { to: "/aptitude", label: "Aptitude", icon: Timer },
  { to: "/daily", label: "Daily challenge", icon: CalendarCheck },
  { to: "/experiences", label: "Interview experiences", icon: Building2 },
  { to: "/bookmarks", label: "Bookmarks", icon: BookMarked },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const adminNav = [
  { to: "/admin", label: "Overview", icon: BarChart3 },
  { to: "/admin/content", label: "Roadmap content", icon: ListChecks },
  { to: "/admin/videos", label: "Video library", icon: Youtube },
  { to: "/admin/aptitude", label: "Aptitude bank", icon: ClipboardList },
  { to: "/admin/tests", label: "Aptitude tests", icon: Timer },
  { to: "/admin/daily", label: "Daily challenges", icon: CalendarCheck },
  { to: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/audit", label: "Audit trail", icon: FileClock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </span>
          PlacementCamp
        </Link>
        <button
          className="text-sidebar-foreground/70 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {studentNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={pathname === item.to || pathname.startsWith(item.to + "/")}
            onNavigate={() => setOpen(false)}
          />
        ))}

        {isAdmin ? (
          <>
            <Separator className="my-4 bg-sidebar-border" />
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              Admin
            </p>
            {adminNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={
                  item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to)
                }
                onNavigate={() => setOpen(false)}
              />
            ))}
          </>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium">{profile?.full_name || "Student"}</p>
        <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <div className="flex">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border lg:block">
          {sidebar}
        </aside>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-foreground/40"
              aria-label="Close menu overlay"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 shadow-xl">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-h-screen w-full flex-col lg:pl-64">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:hidden">
            <button onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-display font-semibold">PlacementCamp</span>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
