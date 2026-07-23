import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    let query = context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { orders: rows ?? [] };
  });

export const markOrderShipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId || typeof input.orderId !== "string") {
      throw new Error("orderId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: updated, error } = await context.supabase
      .from("orders")
      .update({ status: "shipped", updated_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("order-shipped", updated.customer_email, {
        templateData: {
          customerName: updated.customer_name,
          orderId: updated.id,
          shippingStreet: updated.shipping_street,
          shippingPostalCode: updated.shipping_postal_code,
          shippingCity: updated.shipping_city,
        },
        idempotencyKey: `order-shipped-${updated.id}`,
      });
    } catch (err) {
      console.error("[email] shipped notification failed", err);
    }

    return { order: { id: updated.id, status: updated.status } };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId || typeof input.orderId !== "string") {
      throw new Error("orderId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch order to get items
    const { data: order, error: fetchErr } = await context.supabase
      .from("orders")
      .select("status, items")
      .eq("id", data.orderId)
      .single();

    if (fetchErr || !order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Already cancelled");

    // Restore stock if it was paid
    if (order.status === "paid" || order.status === "shipped") {
      const itemsToUpdate = Array.isArray(order.items) ? (order.items as Array<any>) : [];
      for (const item of itemsToUpdate) {
        if (!item.seller_id) continue;
        const { data: prod } = await supabaseAdmin
          .from("products")
          .select("quantity_limit")
          .eq("slug", item.seller_id)
          .single();
          
        if (prod && typeof prod.quantity_limit === "number") {
          const newLimit = prod.quantity_limit + (item.quantity || 1);
          await supabaseAdmin.from("products").update({ quantity_limit: newLimit, is_active: true }).eq("slug", item.seller_id);
        }
      }
    }

    const { data: updated, error } = await context.supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { order: { id: updated.id, status: updated.status } };
  });

export const updateOrderNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; notes: string }) => {
    if (!input?.orderId || typeof input.orderId !== "string") {
      throw new Error("orderId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("orders")
      .update({ admin_notes: data.notes, updated_at: new Date().toISOString() })
      .eq("id", data.orderId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId || typeof input.orderId !== "string") {
      throw new Error("orderId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("orders")
      .delete()
      .eq("id", data.orderId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const createManualOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string, productName: string, priceGrosze: number, currency: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    // Deduct stock
    const { data: product, error: pError } = await context.supabase
      .from("products")
      .select("quantity_limit, is_active")
      .eq("id", data.productId)
      .single();
      
    if (pError || !product) throw new Error("Product not found");
    
    if (product.quantity_limit !== null) {
      const newLimit = Math.max(0, product.quantity_limit - 1);
      await context.supabase
        .from("products")
        .update({ quantity_limit: newLimit, is_active: newLimit > 0 ? product.is_active : false })
        .eq("id", data.productId);
    }
    
    const { error: oError } = await context.supabase
      .from("orders")
      .insert({
        id: crypto.randomUUID(),
        status: "shipped", // Manual sales are considered fulfilled
        customer_email: "reczna.sprzedaz@pufkuj.pl",
        customer_name: "Sprzedaż ręczna",
        customer_phone: "-",
        shipping_street: "-",
        shipping_city: "-",
        shipping_postal_code: "-",
        items: [{
          id: data.productId,
          name: data.productName,
          price_grosze: data.priceGrosze,
          quantity: 1
        }],
        total_grosze: data.priceGrosze,
        items_total_grosze: data.priceGrosze,
        shipping_cost_grosze: 0,
        currency: data.currency,
        admin_notes: "Dodane ręcznie przez panel",
        paid_at: new Date().toISOString()
      });
      
    if (oError) throw new Error(oError.message);
    
    return { success: true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });
