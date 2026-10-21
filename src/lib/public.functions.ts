import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { clientIdentifier, enforceRateLimit } from "./rate-limit.server";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a bit more").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const identifier = clientIdentifier(request.headers, data.email.toLowerCase());

    const limit = await enforceRateLimit({
      bucket: "contact",
      identifier,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!limit.allowed) {
      return {
        ok: false as const,
        error: "Too many messages from this device. Please try again later.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: data.subject || null,
      message: data.message,
    });

    if (error) return { ok: false as const, error: "We couldn't send your message. Try again." };
    return { ok: true as const };
  });

/** Abuse protection for sign-up / sign-in / password-reset attempts. */
export const checkAuthRateLimit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        action: z.enum(["signup", "login", "reset"]),
        email: z.string().trim().email().max(255),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = clientIdentifier(request.headers, "unknown");
    const perAction = { signup: 5, login: 10, reset: 4 } as const;

    const byIp = await enforceRateLimit({
      bucket: `auth:${data.action}:ip`,
      identifier: ip,
      limit: perAction[data.action] * 3,
      windowSeconds: 900,
    });
    const byEmail = await enforceRateLimit({
      bucket: `auth:${data.action}:email`,
      identifier: data.email.toLowerCase(),
      limit: perAction[data.action],
      windowSeconds: 900,
    });

    if (!byIp.allowed || !byEmail.allowed) {
      return {
        allowed: false as const,
        error: "Too many attempts. Please wait a few minutes and try again.",
      };
    }
    return { allowed: true as const };
  });
