import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import type { Product } from "@/lib/onecart.functions";
// OneCartWidgetPreview: usunięty z UI po migracji na własny checkout Stripe.
// Plik komponentu pozostaje w repo, fallback window.oneCart / USE_ONECART_FALLBACK bez zmian.
import { CustomOrderForm } from "@/components/custom-order-form";

const exampleImages: Record<string, string> = {
  "osmiorniczka-koralowa": "/products/examples/osmiorniczka.png",
  "zolwik-mietowy": "/products/examples/zolwik.png",
  "axolotl-rozowy": "/products/examples/axolotl.png",
};

type TiktokStory = { href: string; title: string; alt: string; image: string };

const defaultTiktokStories: TiktokStory[] = [
  {
    href: "https://www.tiktok.com/@pufkuj/video/7646034640045608225",
    image: "/assets/tiktok/pierwszy-targ.jpg",
    title: "Pierwszy targ — maskotki na żywo",
    alt: "Ręcznie szydełkowana truskawka przygotowywana na pierwszy targ Pufkuj",
  },
  {
    href: "https://www.tiktok.com/@pufkuj/video/7648541889385352481",
    image: "/assets/tiktok/drugi-targ.jpg",
    title: "Kolekcja gotowa na drugi targ",
    alt: "Przygotowania kolekcji Pufkuj na drugi targ",
  },
  {
    href: "https://www.tiktok.com/@pufkuj/video/7647921711899364641",
    image: "/assets/tiktok/pakowanie-zamowienia.jpg",
    title: "Każde zamówienie pakuję z troską",
    alt: "Bartosz pakuje ręcznie szydełkowaną maskotkę Pufkuj",
  },
  {
    href: "https://www.tiktok.com/@pufkuj/photo/7652001932860460321",
    image: "/assets/tiktok/historia-tworcy.jpg",
    title: "Szydełkowanie to moja prawdziwa pasja",
    alt: "Bartosz szydełkuje maskotkę z miękkiej włóczki",
  },
];

function cleanText(value: string | null) {
  if (!value) return "Maskotka wykonana ręcznie, oczko po oczku.";
  return (
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/Przykładowy produkt demonstracyjny\.?/gi, " ")
      .replace(/Tryb demonstracyjny[^.]*\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || "Maskotka wykonana ręcznie, oczko po oczku."
  );
}

function friendlyName(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("pl"));
}

function isPositiveLimit(limit: number | null | undefined): limit is number {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0;
}

export function Storefront({
  products,
  demo,
  tiktokStories: tiktokStoriesProp,
}: {
  products: Product[];
  demo: boolean;
  tiktokStories?: { href: string; title: string; alt: string; image: string }[];
}) {
  const tiktokStories = tiktokStoriesProp ?? defaultTiktokStories;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const cartItems = useMemo(
    () =>
      products
        .filter((product) => cart[product.seller_id])
        .map((product) => ({ product, quantity: cart[product.seller_id] })),
    [cart, products],
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (item.product.price_amount ?? 0) * item.quantity,
    0,
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pufki-cart");
      if (saved) setCart(JSON.parse(saved) as Record<string, number>);
    } catch {
      window.localStorage.removeItem("pufki-cart");
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (cartReady) window.localStorage.setItem("pufki-cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const changeQuantity = (
    sellerId: string,
    change: number,
    limit?: number | null,
    productName?: string,
  ) => {
    setCart((current) => {
      const currentQty = current[sellerId] ?? 0;
      const requested = currentQty + change;
      const hasLimit = isPositiveLimit(limit);
      const capped = hasLimit ? Math.min(requested, limit) : requested;
      const next = Math.max(0, capped);
      if (change > 0 && hasLimit && requested > limit) {
        toast.message(
          productName
            ? `Dostępny limit dla „${productName}” to ${limit} szt.`
            : `Dostępny limit tego produktu to ${limit} szt.`,
        );
      }
      if (next === 0) {
        const { [sellerId]: _removed, ...rest } = current;
        void _removed;
        return rest;
      }
      return { ...current, [sellerId]: next };
    });
  };

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Pufkuj — strona główna">
          pufkuj<span>♥</span>
        </a>
        <nav aria-label="Główna nawigacja">
          <a href="#kolekcja">Kolekcja</a>
          <a href="#o-nas">Dlaczego Pufkuj</a>
          <a href="https://www.instagram.com/pufkuj.pl/" target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href="https://www.tiktok.com/@pufkuj" target="_blank" rel="noreferrer">
            TikTok
          </a>
          <button
            className="navCta cartTrigger"
            type="button"
            onClick={() => setCartOpen(true)}
          >
            Koszyk <span>{cartCount}</span>
          </button>
        </nav>
      </header>

      <section className="hero shell" id="top">
        <div className="heroCopy">
          <p className="heroKicker">Handmade z pasji</p>
          <h1>
            Ręcznie robione
            <br />
            maskotki <span>z miłością</span>
          </h1>
          <p className="lede">
            Każdego pluszaka wykonuję sam z miękkiej włóczki chenille. Powstaje powoli, oczko po
            oczku — specjalnie dla Ciebie.
          </p>
          <a className="primary" href="#kolekcja">
            <svg className="buttonYarn" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="18" cy="20" r="12" />
              <path d="M9 15c6 5 13 7 22 6M7 21c8 3 16 3 24-1M13 10c1 12 6 21 16 27M28 32c5-1 9 1 11 5M9 26c6 1 13 0 20-4" />
            </svg>
            Poznaj maskotki
          </a>
        </div>
        <div className="heroProduct" aria-label="Różowy, ręcznie szydełkowany axolotl">
          <img
            src="/products/hero-axolotl-cutout.png"
            alt="Różowy axolotl wykonany ręcznie na szydełku"
            width={560}
            height={560}
            fetchPriority="high"
            decoding="async"
          />
          <span className="heroStitch" aria-hidden="true">
            ręcznie
            <br />
            szydełkowany
          </span>
        </div>
      </section>

      <section className="promise" id="o-nas">
        <div className="shell promiseGrid">
          <div>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="22" cy="23" r="14" />
              <path d="M10 18c8 5 17 6 26 3M9 25c9 3 18 2 27-2M16 10c1 12 7 22 17 28M35 35c5 0 8 2 10 6" />
            </svg>
            <span>
              <b>Ręczne wykonanie</b>
              <small>Każda sztuka powstaje osobno</small>
            </span>
          </div>
          <div>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 39S8 30 8 19c0-9 11-12 16-4 5-8 16-5 16 4 0 11-16 20-16 20Z" />
              <path d="M18 12c1-3 3-5 6-7" />
            </svg>
            <span>
              <b>Miękka chenille</b>
              <small>Przyjemna w dotyku włóczka</small>
            </span>
          </div>
          <div>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="m9 17 15-8 15 8v19l-15 8-15-8Z" />
              <path d="m9 17 15 8 15-8M24 25v19M17 13l15 8" />
            </svg>
            <span>
              <b>Wysyłka w Polsce</b>
              <small>Lub odbiór w Gorzowie Wlkp.</small>
            </span>
          </div>
        </div>
      </section>

      <section className="orderInfo" aria-labelledby="order-info-title">
        <div className="shell orderInfoGrid">
          <div>
            <p className="eyebrow">Ważne przed zamówieniem</p>
            <h2 id="order-info-title">Pluszak powstaje specjalnie dla Ciebie.</h2>
          </div>
          <div className="orderFacts">
            <p>
              <strong>Czas realizacji</strong>
              <span>
                Termin zależy od wzoru i aktualnej kolejki. Potwierdzimy go przed rozpoczęciem
                pracy.
              </span>
            </p>
            <p>
              <strong>Własny projekt</strong>
              <span>Możesz wybrać wzór, kolor i rozmiar. Cenę ustalamy przed wykonaniem.</span>
            </p>
            <p>
              <strong>Kontakt</strong>
              <span>
                Napisz na Instagramie{" "}
                <a
                  href="https://www.instagram.com/pufkuj.pl/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Pufkuj · @pufkuj.pl
                </a>{" "}
                lub na <a href="mailto:kontakt@pufkuj.pl">kontakt@pufkuj.pl</a>.
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="tiktokStories" id="tiktok" aria-labelledby="tiktok-title">
        <div className="shell">
          <div className="socialProofHead">
            <div>
              <p className="eyebrow">Pufkuj od środka</p>
              <h2 id="tiktok-title">Zobacz, jak naprawdę powstają.</h2>
            </div>
            <p>
              Od pierwszej pętelki, przez przygotowania do targu, aż po pakowanie gotowego
              zamówienia.
            </p>
          </div>
          <div className="tiktokGrid">
            {tiktokStories.map((story) => (
              <a href={story.href} target="_blank" rel="noreferrer" key={story.href}>
                <span className="tiktokVisual">
                  <img src={story.image} alt={story.alt} loading="lazy" width={320} height={400} decoding="async" />
                  <span className="playMark" aria-hidden="true">
                    ▶
                  </span>
                </span>
                <strong>{story.title}</strong>
                <small>
                  TikTok · @pufkuj <span aria-hidden="true">↗</span>
                </small>
              </a>
            ))}
          </div>
          <a
            className="tiktokProfile"
            href="https://www.tiktok.com/@pufkuj"
            target="_blank"
            rel="noreferrer"
          >
            Zobacz więcej na TikToku <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section className="catalog shell" id="kolekcja">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Dostępne stworki</p>
            <h2>Który wybiera Ciebie?</h2>
          </div>
        </div>
        <div className="productGrid">
          {products.map((product, index) => {
            return (
              <article className="product" key={product.id}>
                <div className={`productVisual tone${index % 3}`}>
                  {product.image_hover && (
                    <div className="productHoverBadge">2w1</div>
                  )}
                  {exampleImages[product.seller_id] || product.image_thumbnail || product.image ? (
                    <div className="productImageWrapper">
                      <img
                        className={
                          product.image_thumbnail?.includes("demo-crochet")
                            ? `demoCrop demoCrop${index} baseImage`
                            : "baseImage"
                        }
                        src={
                          exampleImages[product.seller_id] ??
                          product.image_thumbnail ??
                          product.image ??
                          ""
                        }
                        alt={friendlyName(product.name)}
                        width={400}
                        height={400}
                        loading="lazy"
                        decoding="async"
                      />
                      {product.image_hover && (
                        <img
                          className="hoverImage"
                          src={product.image_hover}
                          alt={`${friendlyName(product.name)} - detal`}
                          width={400}
                          height={400}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  ) : (
                    <span className="miniPouf" aria-hidden="true" />
                  )}
                  <span className="productNumber">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <style>{`
                  .productImageWrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                  }
                  .productImageWrapper img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: opacity 0.3s ease;
                  }
                  .hoverImage {
                    position: absolute;
                    top: 0;
                    left: 0;
                    opacity: 0;
                  }
                  .productVisual:hover .hoverImage {
                    opacity: 1;
                  }
                  .productVisual:hover .baseImage {
                    opacity: 0;
                  }
                  .productHoverBadge {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: #fff;
                    color: #000;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 4px 8px;
                    border-radius: 99px;
                    z-index: 10;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  }
                `}</style>
                <div className="productInfo">
                  <div>
                    <h3>{friendlyName(product.name)}</h3>
                    <p>{cleanText(product.short_description)}</p>
                    <ul className="productMeta">
                      <li>{product.yarn_type || "Włóczka chenille"}</li>
                      {product.size && <li>{product.size}</li>}
                      <li className="availability">
                        {product.quantity_limit ? "Gotowy do wysyłki" : "Na zamówienie"}
                      </li>
                    </ul>
                  </div>
                  <div className="buyRow">
                    <strong>{product.price_formatted}</strong>
                    {product.quantity_limit === 1 && (
                      <span style={{ color: "#ef4444", fontSize: 13, fontWeight: "bold" }}>Ostatnia sztuka!</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        changeQuantity(
                          product.seller_id,
                          1,
                          product.quantity_limit,
                          friendlyName(product.name),
                        );
                        setCartOpen(true);
                      }}
                    >
                      Dodaj do koszyka <span aria-hidden="true">＋</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="catalogHint">
          * Zdjęcia mają charakter poglądowy — każda maskotka jest robiona ręcznie, dlatego kolor
          i odcień włóczki mogą się nieznacznie różnić od prezentacji na zdjęciu (wpływ ma też
          indywidualne ustawienie monitora oraz naturalne różnice między partiami włóczki).
        </p>
      </section>

      <section className="howToOrder" aria-labelledby="how-order-title">
        <div className="shell">
          <p className="eyebrow">Zamówienie indywidualne</p>
          <h2 id="how-order-title">Jak zamówić własny wzór?</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Napisz wiadomość</h3>
                <p>Opisz maskotkę, kolor i rozmiar. Możesz dołączyć zdjęcie inspiracji.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Ustalamy szczegóły</h3>
                <p>Przed rozpoczęciem potwierdzamy cenę, dostępność materiałów i termin.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Tworzę i wysyłam</h3>
                <p>
                  Maskotka powstaje ręcznie, a gotowe zamówienie wysyłam lub przekazuję w
                  Gorzowie.
                </p>
              </div>
            </li>
          </ol>
          <CustomOrderForm />
          <a
            className="orderCta orderCta--ghost"
            href="https://www.instagram.com/pufkuj.pl/"
            target="_blank"
            rel="noreferrer"
          >
            Wolę napisać na Instagramie <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer id="kontakt">
        <div className="shell footerGrid">
          <div className="customOrder">
            <p className="eyebrow">Kontakt z Pufkuj</p>
            <h2>
              Masz pytanie
              <br />o maskotkę?
            </h2>
            <p>
              Napisz na <a href="mailto:kontakt@pufkuj.pl">kontakt@pufkuj.pl</a> albo
              odezwij się do Pufkuj w mediach społecznościowych.
            </p>
          </div>
          <div className="socialLinks">
            <a href="https://www.instagram.com/pufkuj.pl/" target="_blank" rel="noreferrer">
              <svg className="socialIcon" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" />
              </svg>{" "}
              Instagram · @pufkuj.pl <span>↗</span>
            </a>
            <a href="https://www.tiktok.com/@pufkuj" target="_blank" rel="noreferrer">
              TikTok · @pufkuj <span>↗</span>
            </a>
          </div>
        </div>
        <div className="shell footerLegalLinks">
          <nav aria-label="Informacje prawne">
            <a href="/regulamin">Regulamin</a>
            <a href="/polityka-prywatnosci">Polityka prywatności</a>
            <a href="/odstapienie">Odstąpienie od umowy</a>
            <a href="/kontakt">Kontakt</a>
          </nav>
          <p>
            Sklep internetowy Pufkuj · Bartosz Gallos · ul. Borowskiego 7b/7, 66-400 Gorzów
            Wielkopolski · <a href="mailto:kontakt@pufkuj.pl">kontakt@pufkuj.pl</a>
          </p>
        </div>
        <div className="shell legal">
          <span>© {new Date().getFullYear()} Bartosz Gallos · Wszelkie prawa zastrzeżone</span>
          <span>Zdjęcia i projekty chronione prawem autorskim · Zakupy obsługuje Stripe</span>
        </div>
      </footer>

      {cartOpen && (
        <div className="cartBackdrop" onMouseDown={() => setCartOpen(false)}>
          <aside
            className="cartDrawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="cartHead">
              <div>
                <p className="eyebrow">Twoje stworki</p>
                <h2 id="cart-title">
                  Koszyk <span>{cartCount}</span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Zamknij koszyk"
                onClick={() => setCartOpen(false)}
              >
                ×
              </button>
            </div>
            {cartItems.length === 0 ? (
              <div className="cartEmpty">
                <span>🧶</span>
                <p>Koszyk jest pusty.</p>
                <button type="button" onClick={() => setCartOpen(false)}>
                  Wybierz maskotkę
                </button>
              </div>
            ) : (
              <>
                <div className="cartItems">
                  {cartItems.map(({ product, quantity }) => (
                    <article className="cartItem" key={product.id}>
                      <img
                        src={
                          exampleImages[product.seller_id] ??
                          product.image_thumbnail ??
                          product.image ??
                          ""
                        }
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        decoding="async"
                      />
                      <div>
                        <h3>{friendlyName(product.name)}</h3>
                        <p>{product.price_formatted}</p>
                        <div className="quantity">
                          <button
                            type="button"
                            aria-label={`Zmniejsz ilość ${friendlyName(product.name)}`}
                            onClick={() => changeQuantity(product.seller_id, -1)}
                          >
                            −
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            aria-label={`Zwiększ ilość ${friendlyName(product.name)}`}
                            onClick={() =>
                              changeQuantity(
                                product.seller_id,
                                1,
                                product.quantity_limit,
                                friendlyName(product.name),
                              )
                            }
                          >
                            ＋
                          </button>
                        </div>
                      </div>
                    </article>

                  ))}
                </div>
                <div className="cartSummary">
                  <div>
                    <span>Razem</span>
                    <strong>
                      {new Intl.NumberFormat("pl-PL", {
                        style: "currency",
                        currency: "PLN",
                      }).format(cartTotal / 100)}
                    </strong>
                  </div>
                  <a
                    className="cartCheckout"
                    href="/checkout"
                    onClick={(e) => {
                      // Primary path: own Stripe checkout at /checkout.
                      // Persist a snapshot the /checkout page reads on mount.
                      if (cartItems.length === 0) {
                        e.preventDefault();
                        return;
                      }
                      try {
                        const snapshot = cartItems.map(({ product, quantity }) => ({
                          seller_id: product.seller_id,
                          name: friendlyName(product.name),
                          price_grosze: product.price_amount ?? 0,
                          quantity,
                          image:
                            exampleImages[product.seller_id] ??
                            product.image_thumbnail ??
                            product.image ??
                            null,
                        }));
                        window.localStorage.setItem(
                          "pufki-cart-snapshot",
                          JSON.stringify(snapshot),
                        );
                      } catch {
                        // ignore storage errors; /checkout will show empty-cart message
                      }

                      // Fallback path (disabled by default): 1koszyk embed widget.
                      // Flip this flag to `true` to route through 1koszyk instead.
                      const USE_ONECART_FALLBACK = false;
                      if (USE_ONECART_FALLBACK) {
                        const widget =
                          typeof window !== "undefined"
                            ? (window as Window & { oneCart?: import("@/types/onecart-widget").OneCartWidget }).oneCart
                            : undefined;
                        if (widget) {
                          e.preventDefault();
                          for (const item of cartItems) {
                            try {
                              widget.addProduct(item.product.short_code_uri);
                            } catch {
                              // ignore
                            }
                          }
                          try {
                            widget.showWidget();
                          } catch {
                            window.open(
                              cartItems[0].product.short_code_uri,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }
                      }
                    }}
                  >
                    Przejdź do zakupu <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      
      <Toaster position="top-center" richColors />
    </main>
  );
}
