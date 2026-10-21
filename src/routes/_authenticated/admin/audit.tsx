import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — PlacementCamp admin" },
      { name: "description", content: "Every content change made by an administrator." },
      { property: "og:title", content: "Audit trail — PlacementCamp admin" },
      { property: "og:description", content: "Every content change made by an administrator." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (r) => !term || `${r.action} ${r.entity_type}`.toLowerCase().includes(term),
  );

  return (
    <div>
      <PageHeader title="Audit trail" description="Recorded automatically, and cannot be edited." />
      <Input
        placeholder="Filter by action or content type"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
        aria-label="Filter audit trail"
      />
      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Publishing, editing or approving content writes an entry here."
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.action}</Badge>
                  <span className="text-sm">{r.entity_type}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
