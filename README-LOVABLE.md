# Instrukcje wdrożeniowe dla Lovable

Ten plik zawiera zestaw aktualizacji dla projektu Pufkuj, obejmujący **integrację InPost (Paczkomaty)** oraz **Zarządzanie produktami (CRUD)** w oparciu o Supabase.

Pliki w tej paczce powinny nadpisać odpowiadające im pliki w Twoim projekcie.

## Co zostało zmienione / dodane:

1. **InPost Geowidget (Paczkomaty) na etapie Checkoutu:**
   - `src/components/inpost-widget.tsx` - Nowy komponent ładujący mapę InPost.
   - `src/routes/checkout.index.tsx` - Rozbudowany o obsługę `shippingMethod` (Kurier vs InPost). Wybór Paczkomatu zapisuje jego identyfikator w Supabase.
   - `src/lib/checkout.functions.ts` - Przekazanie danych o dostawie (metoda i ID punktu) do bazy oraz do maila.
   - `supabase/migrations/20260722144000_add_shipping_point.sql` - Nowa migracja dodająca kolumnę `shipping_point_id` do tabeli `orders`.
   - `src/lib/email-templates/admin-new-order.tsx` - E-mail potwierdzający dla admina zawiera informację o wybranym paczkomacie.

2. **Panel Administratora (Produkty) i Supabase:**
   - `supabase/migrations/20260722145001_seed_products.sql` - Pełny schemat tabeli `public.products` oraz SEED od Claude'a (24 produkty, RLS, Storage Bucket).
   - `src/lib/admin-products.functions.ts` - Serwerowe funkcje wspierające zapis, edycję i usuwanie z Supabase (tylko dla adminów).
   - `src/routes/_authenticated/admin.products.tsx` - Interfejs panelu CRUD (widok tabeli, drag&drop poprzez przesuwanie sort_order, wgrywanie obrazków).
   - `src/routes/_authenticated/admin.orders.tsx` / `admin.users.tsx` - Zaktualizowane nagłówki o zakładkę z nawigacją "Produkty".
   - `src/lib/onecart.functions.ts` - Aktualizacja `getProducts`, dzięki czemu publiczny sklep czyta produkty prosto z `public.products` (z fallbackiem do starych metod, jeśli tabela pusta).

## Twoje kroki:

1. Wgraj (lub skopiuj) wszystkie pliki z tej paczki do swojego środowiska/projektu Lovable (zachowując ich oryginalną strukturę ścieżek `src/...`, `supabase/...`).
2. Wykonaj `supabase db push` by przetworzyć w bazie lokalnej/zdalnej dwie nowe migracje (`_add_shipping_point` oraz `_seed_products`).
3. Rozpakuj uprzednio zrobioną paczkę obrazków od Claude'a i wrzuć zawartość `images/seed/*.webp` prosto do bucketa `products/seed/` na serwerze Supabase.
4. Odpal frontend (`npm run dev`) i ciesz się paczkomatami oraz własną bazą produktów!
