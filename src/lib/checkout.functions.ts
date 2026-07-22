import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  seller_id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  price_grosze: z.number().int().positive().max(10_000_00),
  quantity: z.number().int().positive().max(50),
  image: z.string().max(500).nullable().optional(),
});

const startInput = z.object({
  customerName: z.string().trim().min(2, "Podaj imię i nazwisko").max(120),
  customerEmail: z
    .string()
    .trim()
    .email("Podaj poprawny adres e-mail")
    .max(200),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Podaj numer telefonu")
    .max(30)
    .regex(/^[+0-9\s()-]{6,30}$/, "Podaj poprawny numer telefonu"),
  street: z.string().trim().min(3, "Podaj ulicę i numer").max(200),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{3}$/, "Podaj kod pocztowy w formacie 00-000"),
  city: z.string().trim().min(2, "Podaj miasto").max(120),
  shippingMethod: z.enum(["courier", "inpost"]).default("courier"),
  shippingPointId: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, "Koszyk jest pusty").max(20),
});

const SHIPPING = { label: "Kurier", amount_grosze: 1800, method: "courier" } as const;

async function tryGetUserId(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length);
    if (token.split(".").length !== 3) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await supabase.auth.getClaims(token);
    return data?.claims?.sub ?? null;
  } catch {
    return null;
  }
}

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => startInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("@/lib/stripe.server");

    const userId = await tryGetUserId();

    const itemsTotal = data.items.reduce(
      (sum, it) => sum + it.price_grosze * it.quantity,
      0,
    );
    
    const shipping_amount = data.shippingMethod === "inpost" ? 1500 : SHIPPING.amount_grosze;
    const shipping_label = data.shippingMethod === "inpost" ? "Paczkomat InPost" : SHIPPING.label;
    
    const total = itemsTotal + shipping_amount;
    const itemsCount = data.items.reduce((sum, it) => sum + it.quantity, 0);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone,
        shipping_street: data.street,
        shipping_postal_code: data.postalCode,
        shipping_city: data.city,
        shipping_method: data.shippingMethod,
        shipping_method_label: shipping_label,
        shipping_point_id: data.shippingPointId,
        shipping_cost_grosze: shipping_amount,
        items: data.items,
        items_total_grosze: itemsTotal,
        total_grosze: total,
        currency: "PLN",
      })
      .select("id")
      .single();

    if (error || !order) {
      throw new Error(`Nie udało się utworzyć zamówienia: ${error?.message ?? "brak danych"}`);
    }

    const origin =
      process.env.APP_URL ??
      process.env.VITE_APP_URL ??
      "https://pufki-shop-magic.lovable.app";

    const session = await createCheckoutSession({
      items: data.items.map((it) => ({
        name: it.name,
        amount_grosze: it.price_grosze,
        quantity: it.quantity,
        image: it.image ?? null,
      })),
      shipping: { label: shipping_label, amount_grosze: shipping_amount },
      customerEmail: data.customerEmail,
      orderId: order.id,
      successUrl: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?cancelled=1`,
    });

    if (!session.url) {
      throw new Error("Stripe nie zwrócił URL sesji płatności");
    }

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return {
      orderId: order.id,
      url: session.url,
      itemsCount,
      total_grosze: total,
    };
  });

const confirmInput = z.object({
  sessionId: z.string().trim().min(5).max(200),
});

export const confirmCheckout = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => confirmInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retrieveCheckoutSession } = await import("@/lib/stripe.server");

    const session = await retrieveCheckoutSession(data.sessionId);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("stripe_session_id", data.sessionId)
      .maybeSingle();

    if (!order) {
      return {
        found: false as const,
      };
    }

    let nextStatus: "paid" | "failed" | "cancelled" | "pending" = order.status as
      | "paid"
      | "failed"
      | "cancelled"
      | "pending";
    if (session.status === "complete" && session.payment_status === "paid") {
      nextStatus = "paid";
    } else if (session.status === "expired") {
      nextStatus = "cancelled";
    } else if (session.payment_status === "unpaid" && session.status === "complete") {
      nextStatus = "failed";
    }

    const wasPaidBefore = order.status === "paid";
    if (nextStatus !== order.status || session.payment_intent) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: nextStatus,
          stripe_payment_intent_id: session.payment_intent ?? undefined,
          paid_at: nextStatus === "paid" ? new Date().toISOString() : undefined,
        })
        .eq("id", order.id);
    }

    // Send confirmation + admin notification on first transition to "paid"
    if (nextStatus === "paid" && !wasPaidBefore) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const items = Array.isArray(order.items) ? order.items : [];
        const templateData = {
          orderId: order.id,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          items,
          itemsTotalGrosze: order.items_total_grosze,
          shippingLabel: order.shipping_method_label,
          shippingCostGrosze: order.shipping_cost_grosze,
          totalGrosze: order.total_grosze,
          shippingStreet: order.shipping_street,
          shippingPostalCode: order.shipping_postal_code,
          shippingCity: order.shipping_city,
          shippingMethodLabel: order.shipping_method_label,
          shippingPointId: order.shipping_point_id,
        };
        await Promise.allSettled([
          sendTemplateEmail("order-confirmation", order.customer_email, {
            templateData,
            idempotencyKey: `order-confirmation-${order.id}`,
          }),
          sendTemplateEmail("admin-new-order", "kontakt@pufkuj.pl", {
            templateData,
            idempotencyKey: `admin-new-order-${order.id}`,
            replyTo: order.customer_email,
          }),
        ]);
      } catch (err) {
        console.error("[email] paid notification failed", err);
      }
    }

    const items = Array.isArray(order.items) ? (order.items as Array<{ quantity?: number }>) : [];
    const itemsCount = items.reduce(
      (sum, it) => sum + (typeof it.quantity === "number" ? it.quantity : 0),
      0,
    );

    return {
      found: true as const,
      orderId: order.id,
      status: nextStatus,
      total_grosze: order.total_grosze as number,
      currency: (order.currency as string) ?? "PLN",
      itemsCount,
    };
  });

