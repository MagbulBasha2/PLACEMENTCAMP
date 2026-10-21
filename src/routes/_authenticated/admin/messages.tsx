import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({
    meta: [
      { title: "Contact messages — PlacementCamp admin" },
      { name: "description", content: "Messages sent through the public contact form." },
      { property: "og:title", content: "Contact messages — PlacementCamp admin" },
      { property: "og:description", content: "Messages sent through the public contact form." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, handled }: { id: string; handled: boolean }) => {
      const { error } = await supabase.from("contact_messages").update({ handled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message updated");
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: () => toast.error("Couldn't update this message."),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const rows = query.data ?? [];

  return (
    <div>
      <PageHeader title="Contact messages" description="Sent from the public landing page." />
      {rows.length === 0 ? (
        <EmptyState title="No messages yet" description="Enquiries from the contact form appear here." />
      ) : (
        <div className="space-y-4">
          {rows.map((m) => (
            <article key={m.id} className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{m.subject || "No subject"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {m.name} · {m.email}
                  </p>
                </div>
                <Badge variant={m.handled ? "secondary" : "default"}>
                  {m.handled ? "handled" : "new"}
                </Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle.mutate({ id: m.id, handled: !m.handled })}
                >
                  Mark as {m.handled ? "new" : "handled"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
