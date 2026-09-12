import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://pufkuj.pl";

function NotFoundComponent() {
  return (
    <div className="legalPage">
      <div className="legalDocument shell" style={{ textAlign: "center" }}>
        <h1>404</h1>
        <p>Ta strona nie istnieje lub została przeniesiona.</p>
        <Link to="/" className="orderCta" style={{ marginTop: 24 }}>
          ← Wróć do sklepu
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="legalPage">
      <div className="legalDocument shell" style={{ textAlign: "center" }}>
        <h1>Coś nie zadziałało</h1>
        <p>Spróbuj ponownie za chwilę.</p>
        <button
          type="button"
          className="orderCta"
          style={{ marginTop: 24, border: 0, cursor: "pointer" }}
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const fbVerification = import.meta.env.VITE_FACEBOOK_DOMAIN_VERIFICATION;
    const onecartEmbedSrc = import.meta.env.VITE_ONECART_EMBED_SRC;

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Pufkuj – Ręcznie robione maskotki szydełkowe z miłością" },
        {
          name: "description",
          content:
            "Ręcznie robione maskotki szydełkowe z włóczki chenille. Przytulne pluszaki tworzone z pasją w Gorzowie Wielkopolskim.",
        },
        { name: "author", content: "Bartosz Gallos" },
        ...(fbVerification
          ? [{ name: "facebook-domain-verification", content: fbVerification }]
          : []),
        { property: "og:title", content: "Pufkuj – Ręcznie robione maskotki szydełkowe z miłością" },
        {
          property: "og:description",
          content:
            "Ręcznie robione maskotki szydełkowe z włóczki chenille. Przytulne pluszaki tworzone z pasją w Gorzowie Wielkopolskim.",
        },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pl_PL" },
        { property: "og:image", content: `${SITE_URL}/og-image.png` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:url", content: `${SITE_URL}/` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
        { name: "twitter:title", content: "Pufkuj – Ręcznie robione maskotki szydełkowe z miłością" },
        { name: "twitter:description", content: "Ręcznie robione maskotki szydełkowe z włóczki chenille. Przytulne pluszaki tworzone z pasją w Gorzowie Wielkopolskim." },
      ],
      links: [
        { rel: "canonical", href: `${SITE_URL}/` },
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap",
        },
      ],
      scripts: [
        ...(onecartEmbedSrc ? [{ id: "onecart", src: onecartEmbedSrc, async: true }] : []),
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Pufkuj",
            url: SITE_URL,
            logo: `${SITE_URL}/logo-pufki.svg`,
            email: "kontakt@pufkuj.pl",
            sameAs: ["https://www.instagram.com/pufkuj.pl/"],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Pufkuj",
            url: SITE_URL,
            inLanguage: "pl-PL",
          }),
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSignedIn(!!session);
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ position: "fixed", top: 12, right: 16, zIndex: 100, fontSize: 14 }}>
        {signedIn ? (
          <Link to="/moje-zamowienia" style={{ background: "rgba(255,255,255,0.9)", padding: "6px 12px", borderRadius: 6, textDecoration: "none", color: "#4a3a4a", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
            Moje zamówienia
          </Link>
        ) : (
          <Link to="/auth" style={{ background: "rgba(255,255,255,0.9)", padding: "6px 12px", borderRadius: 6, textDecoration: "none", color: "#4a3a4a", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
            Zaloguj się
          </Link>
        )}
      </div>
      <Outlet />
    </QueryClientProvider>
  );
}
