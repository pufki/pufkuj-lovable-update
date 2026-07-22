import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireAdmin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) throw new Error("Invalid token");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  
  const { data: claims } = await supabase.auth.getClaims(token);
  const appRole = claims?.claims?.app_role;
  if (appRole !== "admin") throw new Error("Forbidden: require admin");
  
  return true;
}

export const listAllProducts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { products: data ?? [] };
});

const productSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  short_description: z.string().nullable().optional(),
  description_md: z.string().nullable().optional(),
  price_grosze: z.number().int().positive(),
  currency: z.string().default("PLN"),
  image_path: z.string().nullable().optional(),
  image_alt: z.string().nullable().optional(),
  quantity_limit: z.number().int().nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => productSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("products")
        .update(data)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("products")
        .insert(data);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

const deleteInput = z.object({ id: z.string() });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => deleteInput.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
