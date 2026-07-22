-- =====================================================================
-- Pufkuj — migracja: tabela public.products + seed 24 produktów
-- Wersja: 2026-07-22
-- Zależność: public.has_role(uuid, app_role) oraz public.set_updated_at()
--            (już istnieją w projekcie).
-- =====================================================================

-- 1) TABELA
CREATE TABLE IF NOT EXISTS public.products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  short_description text,
  description_md    text,
  price_grosze      integer NOT NULL CHECK (price_grosze > 0),
  currency          text NOT NULL DEFAULT 'PLN',
  image_path        text,                    -- ścieżka w Storage bucket 'products'
  image_alt         text,
  quantity_limit    integer,                 -- NULL = brak limitu
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTY (Data API / PostgREST)
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL    ON public.products TO service_role;

-- 3) RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products public read active" ON public.products;
CREATE POLICY "products public read active"
  ON public.products FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "products admin all" ON public.products;
CREATE POLICY "products admin all"
  ON public.products FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) TRIGGER updated_at
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) INDEKSY
CREATE INDEX IF NOT EXISTS products_active_sort_idx
  ON public.products (is_active, sort_order);

-- 6) STORAGE BUCKET 'products' (public read, admin write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "products bucket public read" ON storage.objects;
CREATE POLICY "products bucket public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "products bucket admin write" ON storage.objects;
CREATE POLICY "products bucket admin write"
  ON storage.objects FOR ALL
  TO authenticated
  USING      (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 7) SEED — 24 produkty z pufka.1ct.eu (idempotentny)
--    UWAGA: pliki WebP wgraj do bucketu `products/seed/<slug>.webp`.
--    Znajdziesz je w repo makiety Lovable pod: public/products/*.webp
-- =====================================================================

INSERT INTO public.products
  (slug, name, short_description, price_grosze, currency, image_path, image_alt, quantity_limit, is_active, sort_order)
VALUES
  ('axolotl-rozowy', 'Axolotl różowy', 'Ręcznie szydełkowany pluszak - Axolotl różowy. Idealny na prezent na każdą okazję. Gotowy do wysyłki', 3500, 'PLN', 'seed/axolotl-rozowy.webp', 'Axolotl różowy', NULL, true, 10),
  ('axolotl-zielony', 'Axolotl zielony', 'Ręcznie szydełkowany pluszak - Axolotl zielony. Idealny na prezent na każdą okazję.', 3500, 'PLN', 'seed/axolotl-zielony.webp', 'Axolotl zielony', NULL, true, 20),
  ('bezczelny-zolwik', 'Bezczelny żółwik', 'Ręcznie szydełkowany pluszak - Bezczelny zółwik. Idealny na prezent na każdą okazję.', 4500, 'PLN', 'seed/bezczelny-zolwik.webp', 'Bezczelny żółwik', NULL, true, 30),
  ('brelok-arbuz', 'Brelok - arbuz', 'Ręcznie szydełkowany brelok - arbuz. Idealny do klucz i prezent na każdą okazję.', 2500, 'PLN', 'seed/brelok-arbuz.webp', 'Brelok - arbuz', NULL, true, 40),
  ('brelok-borowka', 'Brelok - borówka', 'Ręcznie szydełkowany brelok - borówka. Idealny do kluczy i prezent na każdą okazję.', 3000, 'PLN', 'seed/brelok-borowka.webp', 'Brelok - borówka', NULL, true, 50),
  ('brelok-krab', 'Brelok - krab', 'Ręcznie szydełkowany brelok - krab. Idealny do kluczy i prezent na każdą okazję.', 2500, 'PLN', 'seed/brelok-krab.webp', 'Brelok - krab', NULL, true, 60),
  ('brelok-niebieski-wielorybek', 'Brelok - niebieski wielorybek', 'Ręcznie szydełkowany brelok - niebieski wielorybek. Idealny do kluczy i prezent na każdą okazję.', 2500, 'PLN', 'seed/brelok-niebieski-wielorybek.webp', 'Brelok - niebieski wielorybek', NULL, true, 70),
  ('brelok-pomarancza', 'Brelok - pomarańcza', 'Ręcznie szydełkowany brelok - pomarańcza. Idealny do kluczy i prezent na każdą okazję.', 3000, 'PLN', 'seed/brelok-pomarancza.webp', 'Brelok - pomarańcza', NULL, true, 80),
  ('duza-truskawka', 'Duża truskawka', 'Ręcznie szydełkowany pluszak - Duża truskawka. Idealna na prezent na każdą okazję.', 7500, 'PLN', 'seed/duza-truskawka.webp', 'Duża truskawka', NULL, true, 90),
  ('gekon-bezowy', 'Gekon beżowy', 'Ręcznie szydełkowany pluszak - Gekon beżowy. Idealny na prezent na każdą okazję.', 3500, 'PLN', 'seed/gekon-bezowy.webp', 'Gekon beżowy', NULL, true, 100),
  ('gekon-ciemno-zielony', 'Gekon ciemno-zielony', 'Ręcznie szydełkowany pluszak - Gekon ciemno-zielony. Idealny na prezent na każdą okazję.', 3500, 'PLN', 'seed/gekon-ciemno-zielony.webp', 'Gekon ciemno-zielony', NULL, true, 110),
  ('ges-z-kanapka', 'Gęś z kanapką', 'Ręcznie szydełkowany pluszak - Gęś z kanapką. Idealna na prezent na każdą okazję.', 7500, 'PLN', 'seed/ges-z-kanapka.webp', 'Gęś z kanapką', NULL, true, 120),
  ('kalamarnica', 'Kałamarnica', 'Ręcznie szydełkowany pluszak - Kałamarnica. Idealna na prezent na każdą okazję.', 3500, 'PLN', 'seed/kalamarnica.webp', 'Kałamarnica', NULL, true, 130),
  ('osmiornica-mala-fioletowa', 'Ośmiornica mała fioletowa', 'Ręcznie szydełkowany pluszak - Ośmiornica mała fioletowa. Idealna na prezent na każdą okazję', 4000, 'PLN', 'seed/osmiornica-mala-fioletowa.webp', 'Ośmiornica mała fioletowa', NULL, true, 140),
  ('osmiornica-mala-morska', 'Ośmiornica mała morska', 'Ręcznie szydełkowany pluszak - ośmiornica mała morska. Idealna na prezent na każdą okazję.', 4000, 'PLN', 'seed/osmiornica-mala-morska.webp', 'Ośmiornica mała morska', NULL, true, 150),
  ('osmiornica-mala-niebieska', 'Ośmiornica mała niebieska', 'Ręczenie szydełkowany pluszak - Ośmiornica mała niebieska. Idealna na prezent na każdą okazję.', 4000, 'PLN', 'seed/osmiornica-mala-niebieska.webp', 'Ośmiornica mała niebieska', NULL, true, 160),
  ('osmiornica-srednia-fioletowa', 'Ośmiornica średnia fioletowa', 'Ręczenie szydełkowany pluszak - Ośmiornica srednia fioletowa. Idealna na prezent na każdą okazję. Gotowa do wysyłki', 4500, 'PLN', 'seed/osmiornica-srednia-fioletowa.webp', 'Ośmiornica średnia fioletowa', NULL, true, 170),
  ('osmiornica-srednia-niebieska', 'Ośmiornica średnia niebieska', 'Ręcznie szydełkowany pluszak - Ośmiornica średnia niebieska. Idealna na prezent na każdą okazję.', 4500, 'PLN', 'seed/osmiornica-srednia-niebieska.webp', 'Ośmiornica średnia niebieska', NULL, true, 180),
  ('plaszczka-niebieska', 'Płaszczka niebieska', 'Ręcznie szydełkowany pluszak - Płasczka niebieska. Idealna na prezent na każdą okazję.', 3000, 'PLN', 'seed/plaszczka-niebieska.webp', 'Płaszczka niebieska', NULL, true, 190),
  ('ptak-golab', 'Ptak - gołąb', 'Ręcznie szydełkowany pluszak - Ptak gołąb. Idealny na prezent na każdą okazję.', 5000, 'PLN', 'seed/ptak-golab.webp', 'Ptak - gołąb', NULL, true, 200),
  ('ptak-kurczak', 'Ptak - kurczak', 'Ręcznie szydełkowany pluszak - Ptak kurczak. Idealny na prezent na każdą okazję.', 4500, 'PLN', 'seed/ptak-kurczak.webp', 'Ptak - kurczak', NULL, true, 210),
  ('ptak-mewa', 'Ptak - mewa', 'Ręcznie szydełkowany pluszak - Ptak mewa. Idealna na prezent na każdą okazję.', 4500, 'PLN', 'seed/ptak-mewa.webp', 'Ptak - mewa', NULL, true, 220),
  ('ptak-orzel', 'Ptak - orzeł', 'Ręcznie szydełkowany pluszak - Ptak orzeł. Idealny na prezent na każdą okazję.', 4500, 'PLN', 'seed/ptak-orzel.webp', 'Ptak - orzeł', NULL, true, 230),
  ('zjarana-kaczka', 'Zjarana kaczka', 'Ręczenie szydełkowany pluszak - Zjarana kaczka. Idealna na prezent na każdą okazję.', 7500, 'PLN', 'seed/zjarana-kaczka.webp', 'Zjarana kaczka', NULL, true, 240)
ON CONFLICT (slug) DO NOTHING;
