import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stripe webhook endpoint.
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   URL:    https://pufkuj.pl/api/public/stripe-webhook
 *   Events: checkout.session.completed
 *           checkout.session.async_payment_succeeded
 *           checkout.session.async_payment_failed
 *           checkout.session.expired
 *           payment_intent.payment_failed
 *
 * Requires secret STRIPE_WEBHOOK_SECRET (whsec_...) in project env.
 */

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      object: string;
      metadata?: Record<string, string>;
      payment_status?: string;
      status?: string;
      payment_intent?: string | null;
      amount_total?: number | null;
      currency?: string | null;
      customer_email?: string | null;
    };
  };
};

function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type OrderPatch = {
  status?: string;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
};

async function markOrder(orderId: string, patch: OrderPatch): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("orders")
    .update(patch)
    .eq("id", orderId);
  if (error) throw new Error(`orders update failed: ${error.message}`);
}

async function logWebhookError(message: string, context: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("error_logs").insert({
      error_message: `[stripe-webhook] ${message}`,
      context: JSON.stringify(context),
    });
  } catch {
    // swallow — logging must never break the webhook
  }
}

// @ts-expect-error routeTree not generated yet
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }

        // Read raw body BEFORE any parsing — required for signature check.
        const payload = await request.text();
        const signature = request.headers.get("stripe-signature");

        if (!verifyStripeSignature(payload, signature, secret)) {
          return new Response("Invalid signature", { status: 400 });
        }

        let event: StripeEvent;
        try {
          event = JSON.parse(payload) as StripeEvent;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        try {
          const obj = event.data.object;
          const orderId = obj.metadata?.order_id;

          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              if (!orderId) break;
              if (obj.payment_status === "paid") {
                await markOrder(orderId, {
                  status: "paid",
                  stripe_session_id: obj.id,
                  stripe_payment_intent_id: obj.payment_intent ?? null,
                  paid_at: new Date().toISOString(),
                });
              } else if (obj.payment_status === "unpaid") {
                // BLIK / P24 pending confirmation
                await markOrder(orderId, {
                  status: "pending",
                  stripe_session_id: obj.id,
                  stripe_payment_intent_id: obj.payment_intent ?? null,
                });
              }
              break;
            }
            case "checkout.session.async_payment_failed":
            case "payment_intent.payment_failed": {
              if (!orderId) break;
              await markOrder(orderId, { status: "failed" });
              break;
            }
            case "checkout.session.expired": {
              if (!orderId) break;
              await markOrder(orderId, { status: "cancelled" });
              break;
            }
            default:
              // ignore other event types
              break;
          }

          return Response.json({ received: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logWebhookError(message, {
            event_id: event.id,
            event_type: event.type,
          });
          // Return 500 so Stripe retries.
          return new Response("Handler error", { status: 500 });
        }
      },
    },
  },
});
