import { supabase } from "@/integrations/supabase/client";

/**
 * Records an admin content change. RLS only accepts these rows from an admin
 * whose id matches actor_id, so students cannot forge audit entries.
 */
export async function logAdminAction(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabase.from("admin_audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    details: (input.details ?? {}) as never,
  });
}
