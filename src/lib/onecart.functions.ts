import { createServerFn } from "@tanstack/react-start";

type RawPrice =
  | string
  | number
  | null
  | undefined
  | {
      amount?: string | number | null;
      value?: string | number | null;
      gross?: string | number | null;
      currency?: string | null;
      formatted?: string | null;
    };

type RawProduct = {
  id: string;
  seller_id: string;
  short_code_uri: string;
  name: string;
  short_description: string | null;
  image: string | null;
  image_thumbnail: string | null;
  price: RawPrice;
  quantity_limit?: number | null;
};

export type Product = {
  id: string;
  seller_id: string;
  short_code_uri: string;
  name: string;
  short_description: string | null;
  image: string | null;
  image_thumbnail: string | null;
  /** Raw, kept for reference/back-compat. */
  price: RawPrice;
  /** Normalized integer amount in grosze; null when unavailable. */
  price_amount: number | null;
  /** Pre-formatted, human-readable price string (always safe to render). */
  price_formatted: string;
  price_currency: string;
  quantity_limit?: number | null;
};

const FALLBACK_LABEL = "Cena na zapytanie";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/\s+/g, "").replace(",", ".");
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Single resilient price normalization at the data boundary. */
function normalizePrice(raw: RawPrice): {
  amount: number | null;
  formatted: string;
  currency: string;
} {
  let currency = "PLN";
  let amount: number | null = null;
  let preformatted: string | null = null;

  if (raw && typeof raw === "object") {
    if (raw.currency) currency = raw.currency;
    if (raw.formatted) preformatted = raw.formatted;
    amount = toNumber(raw.amount) ?? toNumber(raw.value) ?? toNumber(raw.gross);
  } else {
    amount = toNumber(raw);
  }

  if (amount === null) {
    return { amount: null, formatted: preformatted ?? FALLBACK_LABEL, currency };
  }

  const formatted =
    preformatted ??
    new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(amount / 100);

  return { amount, formatted, currency };
}

function normalizeProduct(raw: RawProduct): Product {
  const { amount, formatted, currency } = normalizePrice(raw.price);
  return {
    ...raw,
    price_amount: amount,
    price_formatted: formatted,
    price_currency: currency,
  };
}

const demoProductsRaw: RawProduct[] = [
  {
    id: "demo-obwarzanek",
    seller_id: "osmiorniczka-koralowa",
    short_code_uri: "#kontakt",
    name: "Ośmiorniczka koralowa",
    short_description: "Miękka ośmiorniczka wykonana ręcznie na szydełku.",
    image: null,
    image_thumbnail: "/products/demo-crochet-triptych.png",
    price: "3500",
  },
  {
    id: "demo-walek",
    seller_id: "zolwik-mietowy",
    short_code_uri: "#kontakt",
    name: "Żółwik miętowy",
    short_description: "Mały żółwik z miękkiej włóczki, każdy z własnym charakterem.",
    image: null,
    image_thumbnail: "/products/demo-crochet-triptych.png",
    price: "4500",
  },
  {
    id: "demo-kostka",
    seller_id: "axolotl-rozowy",
    short_code_uri: "#kontakt",
    name: "Axolotl różowy",
    short_description: "Kolorowy axolotl szydełkowany ręcznie, oczko po oczku.",
    image: null,
    image_thumbnail: "/products/demo-crochet-triptych.png",
    price: "6000",
  },
];

const demoProducts: Product[] = demoProductsRaw.map(normalizeProduct);

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: Product[]; demo: boolean }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Błąd pobierania produktów z Supabase:", error);
      } else if (data && data.length > 0) {
        const supabaseProducts: Product[] = data.map((p) => {
          const imageUrl = p.image_path
            ? `${process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL}/storage/v1/object/public/products/${p.image_path}`
            : null;
            
          return {
            id: p.id,
            seller_id: p.slug, // Używamy sluga jako seller_id (identyfikator produktu)
            short_code_uri: `#${p.slug}`,
            name: p.name,
            short_description: p.short_description,
            image: imageUrl,
            image_thumbnail: imageUrl,
            price: p.price_grosze,
            price_amount: p.price_grosze,
            price_formatted: new Intl.NumberFormat("pl-PL", { style: "currency", currency: p.currency }).format(p.price_grosze / 100),
            price_currency: p.currency,
            quantity_limit: p.quantity_limit,
          };
        });
        return { products: supabaseProducts, demo: false };
      }
    } catch (e) {
      console.error("Błąd krytyczny Supabase:", e);
    }

    if (process.env.USE_LOCAL_SEED === "true") {
      return { products: demoProducts, demo: true };
    }

    const apiKey = process.env.ONECART_API_KEY;
    const clientId = process.env.ONECART_CLIENT_ID;
    const apiUrl = process.env.ONECART_API_URL ?? "https://api.1cart.eu/v1";

    if (!apiKey || !clientId) {
      return { products: demoProducts, demo: true };
    }

    try {
      const response = await fetch(`${apiUrl}/products/all?disabled=0`, {
        headers: { "X-API-key": apiKey, "X-client-id": clientId },
      });
      if (!response.ok) throw new Error(`1koszyk API: ${response.status}`);
      const raw = (await response.json()) as RawProduct[];
      return { products: raw.map(normalizeProduct), demo: false };
    } catch (error) {
      console.error("Nie udało się pobrać katalogu z 1koszyk", error);
      return { products: demoProducts, demo: true };
    }
  },
);
