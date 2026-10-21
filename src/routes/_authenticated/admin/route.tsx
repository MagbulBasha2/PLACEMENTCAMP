import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) return <LoadingState rows={2} />;

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Administrators only"
        description="This area manages content and student data, so it is restricted to admin accounts."
        action={
          <Button asChild>
            <Link to="/dashboard">Back to your dashboard</Link>
          </Button>
        }
      />
    );
  }

  return <Outlet />;
}
