import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { checkIsAdmin } from "@/lib/admin-orders.functions";
import { listAllProducts, saveProduct, deleteProduct } from "@/lib/admin-products.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Panel Produktów – Pufkuj" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const fetchProducts = useServerFn(listAllProducts);
  const saveProductFn = useServerFn(saveProduct);
  const deleteProductFn = useServerFn(deleteProduct);

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
  });

  const productsQ = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetchProducts(),
    enabled: adminQ.data?.isAdmin === true,
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => saveProductFn({ data }),
    onSuccess: () => {
      toast.success("Zapisano produkt");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setIsFormOpen(false);
      setEditingProduct(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Błąd zapisu"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProductFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Usunięto produkt");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Błąd usuwania"),
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    setUploading(false);

    if (uploadError) {
      toast.error("Błąd wgrywania zdjęcia: " + uploadError.message);
    } else {
      setEditingProduct({ ...editingProduct, image_path: filePath });
      toast.success("Wgrano zdjęcie");
    }
  }

  async function handleSort(id: string, currentSort: number, direction: 1 | -1) {
    const products = productsQ.data?.products ?? [];
    const currentIndex = products.findIndex((p: any) => p.id === id);
    const swapIndex = currentIndex + direction;
    if (swapIndex < 0 || swapIndex >= products.length) return;
    
    const swapProduct = products[swapIndex];
    
    // Swap sort_orders
    await saveProductFn({ data: { ...products[currentIndex], sort_order: swapProduct.sort_order } });
    await saveProductFn({ data: { ...swapProduct, sort_order: currentSort } });
    
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  }

  if (adminQ.isLoading) {
    return <div className="legalPage"><div className="legalDocument shell"><p>Sprawdzanie uprawnień…</p></div></div>;
  }

  if (adminQ.data && !adminQ.data.isAdmin) {
    return (
      <div className="legalPage">
        <div className="legalDocument shell">
          <h1>Brak dostępu</h1>
          <p>Twoje konto nie ma uprawnień administratora.</p>
        </div>
      </div>
    );
  }

  const products = productsQ.data?.products ?? [];

  return (
    <div className="legalPage">
      <div className="legalDocument shell" style={{ maxWidth: 1200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Panel Produktów</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin/orders" style={btnGhost as any}>Zamówienia</Link>
            <button type="button" onClick={() => { setEditingProduct({ is_active: true, sort_order: 0 }); setIsFormOpen(true); }} style={btnPrimary}>+ Dodaj produkt</button>
          </div>
        </div>

        {isFormOpen && (
          <form 
            style={{ background: "#f9f9f9", padding: 20, borderRadius: 8, marginBottom: 20, border: "1px solid #ddd" }}
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate(editingProduct);
            }}
          >
            <h2 style={{ marginTop: 0 }}>{editingProduct.id ? "Edytuj produkt" : "Nowy produkt"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nazwa</label>
                <input required style={inputStyle} value={editingProduct.name || ""} onChange={e => setEditingProduct({...editingProduct, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input required style={inputStyle} value={editingProduct.slug || ""} onChange={e => setEditingProduct({...editingProduct, slug: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Krótki opis</label>
                <input style={inputStyle} value={editingProduct.short_description || ""} onChange={e => setEditingProduct({...editingProduct, short_description: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Cena w groszach</label>
                <input required type="number" min="1" style={inputStyle} value={editingProduct.price_grosze || ""} onChange={e => setEditingProduct({...editingProduct, price_grosze: parseInt(e.target.value)})} />
              </div>
              <div>
                <label style={labelStyle}>Limit sztuk</label>
                <input type="number" min="0" style={inputStyle} value={editingProduct.quantity_limit || ""} onChange={e => setEditingProduct({...editingProduct, quantity_limit: e.target.value ? parseInt(e.target.value) : null})} />
              </div>
              <div>
                <label style={labelStyle}>Zdjęcie (Wgraj)</label>
                <input type="file" accept="image/*" style={inputStyle} onChange={handleImageUpload} disabled={uploading} />
                {editingProduct.image_path && <p style={{ fontSize: 12, marginTop: 4 }}>Obecne: {editingProduct.image_path}</p>}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Opis szczegółowy (Markdown)</label>
                <textarea style={{...inputStyle, minHeight: 100}} value={editingProduct.description_md || ""} onChange={e => setEditingProduct({...editingProduct, description_md: e.target.value})} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="is_active" checked={editingProduct.is_active} onChange={e => setEditingProduct({...editingProduct, is_active: e.target.checked})} />
                <label htmlFor="is_active">Produkt aktywny</label>
              </div>
              <div>
                <label style={labelStyle}>Kolejność (sort_order)</label>
                <input type="number" style={inputStyle} value={editingProduct.sort_order || 0} onChange={e => setEditingProduct({...editingProduct, sort_order: parseInt(e.target.value)})} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button type="submit" style={btnPrimary} disabled={saveMut.isPending || uploading}>
                {saveMut.isPending ? "Zapisywanie..." : "Zapisz"}
              </button>
              <button type="button" style={btnGhost} onClick={() => { setIsFormOpen(false); setEditingProduct(null); }}>
                Anuluj
              </button>
            </div>
          </form>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {products.map((p: any, i: number) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, border: "1px solid #eee", borderRadius: 8, background: p.is_active ? "#fff" : "#f5f5f5" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => handleSort(p.id, p.sort_order, -1)} disabled={i === 0} style={{ cursor: "pointer", border: "none", background: "none" }}>▲</button>
                  <button onClick={() => handleSort(p.id, p.sort_order, 1)} disabled={i === products.length - 1} style={{ cursor: "pointer", border: "none", background: "none" }}>▼</button>
                </div>
                {p.image_path ? (
                  <img src={`${process.env.VITE_SUPABASE_URL ?? ""}/storage/v1/object/public/products/${p.image_path}`} alt="thumb" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 50, height: 50, background: "#eee", borderRadius: 4 }} />
                )}
                <div>
                  <div style={{ fontWeight: "bold" }}>{p.name} {p.is_active ? "" : "(Nieaktywny)"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{p.slug} | {p.price_grosze / 100} PLN | Limit: {p.quantity_limit ?? "brak"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnGhost} onClick={() => { setEditingProduct(p); setIsFormOpen(true); }}>Edytuj</button>
                <button style={{ ...btnGhost, color: "red", borderColor: "red" }} onClick={() => { if(confirm("Na pewno usunąć?")) deleteMut.mutate(p.id); }}>Usuń</button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p>Brak produktów.</p>}
        </div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "#b88ab8",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
const btnGhost: React.CSSProperties = {
  background: "none",
  border: "1px solid #b88ab8",
  color: "#5a3a5a",
  padding: "8px 16px",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold", color: "#555" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" };
