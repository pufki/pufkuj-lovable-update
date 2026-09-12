type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  currency?: string;
};

type AnalyticsEventMap = {
  page_view: { page_location?: string; page_title?: string };
  view_item: { currency?: string; value?: number; items: AnalyticsItem[] };
  add_to_cart: { currency?: string; value?: number; items: AnalyticsItem[] };
  begin_checkout: { currency?: string; value?: number; items: AnalyticsItem[] };
  purchase: { transaction_id: string; currency?: string; value?: number; items: AnalyticsItem[] };
  select_content: { content_type: string; content_id?: string };
};

type DataLayerEvent = {
  event: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

const GA_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;

function pushToDataLayer(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...payload });
}

function rememberCampaignParams() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const campaign: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value) campaign[key] = value;
  }
  if (Object.keys(campaign).length) {
    window.localStorage.setItem("pufkuj-attribution", JSON.stringify(campaign));
  }
}

let gaPromise: Promise<void> | null = null;

function loadGoogleAnalytics() {
  if (typeof window === "undefined" || !GA_ID) return Promise.resolve();
  if (window.dataLayer?.some((entry) => entry.event === "gtag_loaded")) return Promise.resolve();
  if (gaPromise) return gaPromise;

  gaPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pufkuj-ga4="${GA_ID}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    script.dataset.pufkujGa4 = GA_ID;
    script.onload = () => {
      const dataLayer = (window.dataLayer ??= []);
      const gtag = (...args: unknown[]) => dataLayer.push(args as unknown as DataLayerEvent);
      window.dataLayer.push({ event: "gtag_loaded" });
      gtag("js", new Date());
      gtag("config", GA_ID, { send_page_view: false });
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return gaPromise;
}

export async function trackEvent<K extends keyof AnalyticsEventMap>(
  event: K,
  payload: AnalyticsEventMap[K],
) {
  pushToDataLayer(event, payload as Record<string, unknown>);
  if (!GA_ID) return;
  await loadGoogleAnalytics();
  const dataLayer = window.dataLayer ?? [];
  dataLayer.push({ event, ...(payload as Record<string, unknown>) });
}

export async function trackPageView() {
  if (typeof window === "undefined") return;
  rememberCampaignParams();
  const payload = {
    page_location: window.location.href,
    page_title: document.title,
  };
  pushToDataLayer("page_view", payload);
  if (!GA_ID) return;
  await loadGoogleAnalytics();
  window.dataLayer?.push({ event: "page_view", ...payload });
}

export function getStoredAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("pufkuj-attribution") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
