// Server-only Stripe REST helper (no SDK — Worker-safe via fetch).
// Never import this from client-reachable modules at module scope.

const STRIPE_API = "https://api.stripe.com/v1";

function requireKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Brak klucza STRIPE_SECRET_KEY w Secrets projektu. Dodaj go w Ustawieniach → Sekrety.",
    );
  }
  return key;
}

function toForm(body: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

async function stripeFetch<T>(path: string, init?: {
  method?: "GET" | "POST";
  body?: string;
}): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init?.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type StripeSession = {
  id: string;
  url: string | null;
  payment_intent: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired" | null;
  amount_total: number | null;
  currency: string | null;
};

export type LineItem = {
  name: string;
  amount_grosze: number;
  quantity: number;
  image?: string | null;
};
function toAbsoluteImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) {
    const base = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    if (/^https?:\/\//i.test(base)) return `${base}${url}`;
  }
  return null;
}


export async function createCheckoutSession(input: {
  items: LineItem[];
  shipping: { label: string; amount_grosze: number };
  customerEmail: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}): Promise<StripeSession> {
  const currency = (input.currency ?? "PLN").toLowerCase();
  const body: Record<string, string | number> = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    "metadata[order_id]": input.orderId,
    "payment_intent_data[metadata][order_id]": input.orderId,
    locale: "pl",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "blik",
    "payment_method_types[2]": "p24",
  };

  input.items.forEach((item, i) => {
    body[`line_items[${i}][quantity]`] = item.quantity;
    body[`line_items[${i}][price_data][currency]`] = currency;
    body[`line_items[${i}][price_data][unit_amount]`] = item.amount_grosze;
    body[`line_items[${i}][price_data][product_data][name]`] = item.name;
    const absImage = toAbsoluteImageUrl(item.image);
    if (absImage) {
      body[`line_items[${i}][price_data][product_data][images][0]`] = absImage;
    }
  });

  // Shipping as an extra line item (skip when free).
  if (input.shipping.amount_grosze > 0) {
    const shippingIdx = input.items.length;
    body[`line_items[${shippingIdx}][quantity]`] = 1;
    body[`line_items[${shippingIdx}][price_data][currency]`] = currency;
    body[`line_items[${shippingIdx}][price_data][unit_amount]`] = input.shipping.amount_grosze;
    body[`line_items[${shippingIdx}][price_data][product_data][name]`] =
      `Dostawa: ${input.shipping.label}`;
  }

  return stripeFetch<StripeSession>("/checkout/sessions", {
    method: "POST",
    body: toForm(body),
  });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeSession> {
  return stripeFetch<StripeSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
