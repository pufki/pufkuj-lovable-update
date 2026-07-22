import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAdmins,
  grantAdminByEmail,
  revokeAdmin,
} from "@/lib/admin-users.functions";
import { checkIsAdmin } from "@/lib/admin-orders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Zarządzanie administratorami – Pufkuj" },
      { name: "description", content: "Panel zarządzania administratorami sklepu Pufkuj." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsersPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL");
}

function AdminUsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const fetchAdmins = useServerFn(listAdmins);
  const grantFn = useServerFn(grantAdminByEmail);
  const revokeFn = useServerFn(revokeAdmin);

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
  });

  const adminsQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchAdmins(),
    enabled: adminQ.data?.isAdmin === true,
  });

  const grantMut = useMutation({
    mutationFn: (e: string) => grantFn({ data: { email: e } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success(`Nadano rolę admina: ${res.email}`);
        setEmail("");
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      } else {
        toast.error(res?.message ?? "Nie znaleziono użytkownika.");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Nie udało się nadać roli"),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Odebrano rolę admina");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Nie udało się odebrać roli"),
  });

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
          <p>Twoje konto nie ma uprawnień administratora.</p>
          <button type="button" onClick={handleSignOut} style={btnGhost}>Wyloguj</button>{" "}
          <Link to="/">← Wróć do sklepu</Link>
        </div>
      </div>
    );
  }

  const admins = adminsQ.data?.admins ?? [];

  return (
    <div className="legalPage">
      <div className="legalDocument shell" style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Administratorzy</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin/orders" style={btnGhost as any}>Zamówienia</Link>
            <Link to="/admin/products" style={btnGhost as any}>Produkty</Link>
            <Link to="/" style={btnGhost as any}>← Sklep</Link>
            <button type="button" onClick={handleSignOut} style={btnGhost}>Wyloguj</button>
          </div>
        </div>

        <section style={{ marginTop: 24, padding: 16, border: "1px solid #e6d8e6", borderRadius: 10, background: "#fff" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Dodaj administratora</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
            Osoba musi mieć wcześniej założone konto na <Link to="/auth">/auth</Link>. Jeśli konta nie ma, otrzymasz komunikat i zaproś ją do rejestracji.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              grantMut.mutate(email.trim());
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adres@e-mail.pl"
              style={{
                flex: "1 1 260px",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 6,
                fontSize: 14,
              }}
            />
            <button type="submit" disabled={grantMut.isPending} style={btnPrimary}>
              {grantMut.isPending ? "Dodawanie…" : "Nadaj rolę admina"}
            </button>
          </form>
        </section>

        {adminsQ.isLoading && <p style={{ marginTop: 20 }}>Ładowanie…</p>}
        {adminsQ.error && <p role="alert" style={{ color: "#b00020" }}>Błąd wczytywania listy.</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          {admins.map((a) => (
            <article key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", border: "1px solid #e6d8e6", borderRadius: 10, padding: 14, background: "#fff" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {a.email}
                  {a.is_self && (
                    <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", background: "#f0e6f0", color: "#5a3a5a", borderRadius: 10 }}>to Ty</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>Nadano: {formatDate(a.created_at)}</div>
              </div>
              <button
                type="button"
                disabled={a.is_self || revokeMut.isPending}
                title={a.is_self ? "Nie możesz odebrać roli samemu sobie" : ""}
                onClick={() => {
                  if (a.is_self) return;
                  if (confirm(`Na pewno odebrać rolę admina użytkownikowi ${a.email}?`)) {
                    revokeMut.mutate(a.user_id);
                  }
                }}
                style={{
                  ...btnGhost,
                  color: a.is_self ? "#aaa" : "#b00020",
                  borderColor: a.is_self ? "#ddd" : "#b00020",
                  cursor: a.is_self ? "not-allowed" : "pointer",
                }}
              >
                Odbierz rolę
              </button>
            </article>
          ))}
          {adminsQ.data && admins.length === 0 && (
            <p style={{ marginTop: 12 }}>Brak administratorów.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
