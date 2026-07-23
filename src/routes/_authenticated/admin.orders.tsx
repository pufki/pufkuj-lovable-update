import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAllOrders,
  markOrderShipped,
  cancelOrder,
  deleteOrder,
  updateOrderNotes,
  checkIsAdmin,
} from "@/lib/admin-orders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Panel zamówień – Pufkuj" },
      { name: "description", content: "Panel administracyjny zamówień sklepu Pufkuj." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje płatności",
  paid: "Opłacone – do wysłania",
  shipped: "Wysłane",
  failed: "Nieudana płatność",
  cancelled: "Anulowane",
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "paid", label: "Do wysłania" },
  { value: "shipped", label: "Wysłane" },
  { value: "pending", label: "Oczekujące" },
  { value: "failed", label: "Nieudane" },
  { value: "cancelled", label: "Anulowane" },
  { value: "all", label: "Wszystkie" },
];

function formatPln(grosze: number, currency = "PLN") {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(
    (grosze ?? 0) / 100,
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL");
}

function AdminOrdersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("paid");

  const fetchList = useServerFn(listAllOrders);
  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const shipFn = useServerFn(markOrderShipped);
  const cancelFn = useServerFn(cancelOrder);
  const deleteFn = useServerFn(deleteOrder);
  const notesFn = useServerFn(updateOrderNotes);

  const [notesState, setNotesState] = useState<Record<string, string>>({});

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
  });

  const ordersQ = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: () => fetchList({ data: { status } }),
    enabled: adminQ.data?.isAdmin === true,
  });

  const shipMut = useMutation({
    mutationFn: (orderId: string) => shipFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Oznaczono jako wysłane");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Nie udało się zaktualizować"),
  });

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => cancelFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Anulowano zamówienie i zwrócono zapasy");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Błąd anulowania"),
  });

  const deleteMut = useMutation({
    mutationFn: (orderId: string) => deleteFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Usunięto zamówienie całkowicie z bazy");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Błąd usuwania"),
  });

  const notesMut = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string, notes: string }) => notesFn({ data: { orderId, notes } }),
    onSuccess: () => {
      toast.success("Zapisano notatkę");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Błąd zapisywania notatki"),
  });

  async function copyAddress(o: any) {
    const text = `${o.customer_name}\n${o.shipping_street}\n${o.shipping_postal_code} ${o.shipping_city}\nTel: ${o.customer_phone}\nEmail: ${o.customer_email}\nMetoda: ${o.shipping_method_label}${o.shipping_point_id ? ` (${o.shipping_point_id})` : ""}`;
    await navigator.clipboard.writeText(text);
    toast.success("Skopiowano adres do schowka");
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (adminQ.isLoading) {
    return <div className="legalPage"><div className="legalDocument shell"><p>Sprawdzanie uprawnień…</p></div></div>;
  }

  if (adminQ.data && !adminQ.data.isAdmin) {
    return (
      <div className="legalPage">
        <div className="legalDocument shell">
          <h1>Brak dostępu</h1>
          <p>
            Twoje konto nie ma uprawnień administratora. Skontaktuj się z właścicielem sklepu,
            aby otrzymać dostęp do panelu zamówień.
          </p>
          <p>Zalogowany jako: <strong>{/* email from session */}</strong></p>
          <button type="button" onClick={handleSignOut} style={btnGhost}>Wyloguj</button>
          {" "}
          <Link to="/">← Wróć do sklepu</Link>
        </div>
      </div>
    );
  }

  const orders = ordersQ.data?.orders ?? [];

  return (
    <div className="legalPage">
      <div className="legalDocument shell" style={{ maxWidth: 1200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Panel zamówień</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin" style={btnGhost as any}>Dashboard</Link>
            <Link to="/admin/orders" style={btnGhost as any}>Zamówienia</Link>
            <Link to="/admin/products" style={btnGhost as any}>Produkty</Link>
            <Link to="/admin/users" style={btnGhost as any}>Administratorzy</Link>
            <Link to="/" style={btnGhost as any}>← Wróć do sklepu</Link>
            <button type="button" onClick={handleSignOut} style={btnGhost}>Wyloguj</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              style={{
                padding: "6px 14px",
                border: "1px solid #b88ab8",
                background: status === f.value ? "#b88ab8" : "transparent",
                color: status === f.value ? "#fff" : "#5a3a5a",
                borderRadius: 20,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {ordersQ.isLoading && <p style={{ marginTop: 20 }}>Ładowanie zamówień…</p>}
        {ordersQ.error && <p role="alert" style={{ color: "#b00020" }}>Błąd wczytywania.</p>}

        {ordersQ.data && orders.length === 0 && (
          <p style={{ marginTop: 24 }}>Brak zamówień w tej kategorii.</p>
        )}

        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          {orders.map((o: any) => {
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <article key={o.id} style={cardStyle}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #eee", paddingBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#888" }}>ID: {o.id}</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(o.created_at)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={statusBadge(o.status)}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                      {formatPln(o.total_grosze, o.currency)}
                    </div>
                  </div>
                </header>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                  <div>
                    <h3 style={sectionH}>Klient</h3>
                    <div>{o.customer_name}</div>
                    <div><a href={`mailto:${o.customer_email}`}>{o.customer_email}</a></div>
                    <div><a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></div>
                  </div>
                  <div>
                    <h3 style={sectionH}>Adres dostawy</h3>
                    <div>{o.shipping_street}</div>
                    <div>{o.shipping_postal_code} {o.shipping_city}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                      {o.shipping_method_label} {o.shipping_point_id && <strong>({o.shipping_point_id})</strong>} ({formatPln(o.shipping_cost_grosze, o.currency)})
                    </div>
                    <button type="button" onClick={() => copyAddress(o)} style={{...btnGhost, fontSize: 11, padding: "4px 8px", marginTop: 8}}>📋 Kopiuj adres</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={sectionH}>Notatki administratora</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      style={{ flex: 1, padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4 }} 
                      placeholder="Wpisz notatkę..." 
                      value={notesState[o.id] !== undefined ? notesState[o.id] : (o.admin_notes || "")}
                      onChange={e => setNotesState(prev => ({...prev, [o.id]: e.target.value}))}
                    />
                    <button 
                      type="button" 
                      style={{...btnGhost, padding: "6px 12px"}}
                      disabled={notesMut.isPending}
                      onClick={() => notesMut.mutate({ orderId: o.id, notes: notesState[o.id] ?? o.admin_notes ?? "" })}
                    >Zapisz</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={sectionH}>Zawartość</h3>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {items.map((it: any, i: number) => (
                      <li key={i}>
                        {it.quantity ?? 1} × {it.name ?? "produkt"}
                        {it.price_grosze != null && (
                          <span style={{ color: "#666" }}>
                            {" "}– {formatPln(it.price_grosze, o.currency)}/szt.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={deleteMut.isPending}
                    onClick={() => { if(confirm("Czy NA PEWNO chcesz usunąć to zamówienie bezpowrotnie z bazy? Zrób to tylko, jeśli to było zamówienie testowe.")) deleteMut.mutate(o.id); }}
                    style={{...btnGhost, color: "red", borderColor: "red", opacity: 0.7}}
                  >
                    🗑️ Usuń całkowicie
                  </button>
                  
                  {(o.status === "paid" || o.status === "pending") && (
                    <button
                      type="button"
                      disabled={cancelMut.isPending}
                      onClick={() => { if(confirm("Na pewno anulować to zamówienie?")) cancelMut.mutate(o.id); }}
                      style={{...btnGhost, color: "red", borderColor: "red"}}
                    >
                      {cancelMut.isPending ? "..." : "Anuluj zamówienie"}
                    </button>
                  )}
                  {o.status === "paid" && (
                    <button
                      type="button"
                      disabled={shipMut.isPending}
                      onClick={() => shipMut.mutate(o.id)}
                      style={btnPrimary}
                    >
                      {shipMut.isPending ? "Zapisywanie…" : "✓ Oznacz jako wysłane"}
                    </button>
                  )}
                </div>
                {o.paid_at && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                    Opłacone: {formatDate(o.paid_at)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e6d8e6",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
};
const sectionH: React.CSSProperties = { margin: "0 0 6px", fontSize: 13, textTransform: "uppercase", color: "#888", letterSpacing: 0.5 };
const btnPrimary: React.CSSProperties = {
  background: "#b88ab8",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
const btnGhost: React.CSSProperties = {
  background: "none",
  border: "1px solid #b88ab8",
  color: "#5a3a5a",
  padding: "6px 14px",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};
function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    paid: "#2e7d32",
    shipped: "#1565c0",
    pending: "#ed6c02",
    failed: "#b00020",
    cancelled: "#666",
  };
  return {
    background: map[status] ?? "#666",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  };
}
