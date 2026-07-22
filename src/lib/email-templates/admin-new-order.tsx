import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { brand, formatPln, type OrderItem } from "./_shared";

interface Props {
  orderId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items?: OrderItem[];
  totalGrosze?: number;
  shippingStreet?: string;
  shippingPostalCode?: string;
  shippingCity?: string;
  shippingMethodLabel?: string;
  shippingPointId?: string | null;
}

const Email = ({
  orderId = "",
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  items = [],
  totalGrosze = 0,
  shippingStreet = "",
  shippingPostalCode = "",
  shippingCity = "",
  shippingMethodLabel = "Kurier",
  shippingPointId = null,
}: Props) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Nowe opłacone zamówienie w Pufkuj</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🎉 Nowe zamówienie #{orderId.slice(0, 8).toUpperCase()}</Heading>
        <Text style={p}>Wartość: <strong>{formatPln(totalGrosze)}</strong></Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Klient</Heading>
          <Text style={p}>
            {customerName}<br />
            {customerEmail}<br />
            {customerPhone}
          </Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Adres wysyłki ({shippingMethodLabel})</Heading>
          <Text style={p}>
            {shippingPointId ? (
              <strong>Paczkomat: {shippingPointId}</strong>
            ) : null}
            <br />
            {shippingStreet}<br />
            {shippingPostalCode} {shippingCity}
          </Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Produkty</Heading>
          {items.map((it, i) => (
            <Text key={i} style={row}>
              <span>{it.name} × {it.quantity}</span>
              <span>{formatPln(it.price_grosze * it.quantity)}</span>
            </Text>
          ))}
          <Hr style={hr} />
          <Text style={{ ...row, fontWeight: 700 }}>
            <span>Razem (z wysyłką)</span>
            <span>{formatPln(totalGrosze)}</span>
          </Text>
        </Section>

        <Text style={muted}>Wejdź do panelu /admin/orders, żeby oznaczyć jako wysłane.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `🎉 Nowe zamówienie #${String(data?.orderId ?? "").slice(0, 8).toUpperCase()} — ${data?.customerName ?? ""}`,
  displayName: "Powiadomienie o nowym zamówieniu (admin)",
  to: "kontakt@pufkuj.pl",
  previewData: {
    orderId: "abcd1234-5678",
    customerName: "Anna Kowalska",
    customerEmail: "anna@example.com",
    customerPhone: "+48 500 000 000",
    items: [{ name: "Pufka różowa", quantity: 1, price_grosze: 8900 }],
    totalGrosze: 10700,
    shippingStreet: "ul. Kwiatowa 5",
    shippingPostalCode: "66-400",
    shippingCity: "Gorzów Wielkopolski",
    shippingMethodLabel: "Paczkomat InPost",
    shippingPointId: "WAW01M",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: brand.text };
const container = { padding: "24px", maxWidth: "560px", margin: "0 auto" };
const h1 = { color: brand.primary, fontSize: 22, margin: "0 0 12px" };
const h2 = { color: brand.text, fontSize: 16, margin: "0 0 12px" };
const p = { color: brand.text, fontSize: 14, lineHeight: "22px", margin: "0 0 12px" };
const muted = { color: brand.muted, fontSize: 12, margin: "8px 0" };
const card = { background: brand.bg, borderRadius: 12, padding: "16px 20px", margin: "16px 0", border: `1px solid ${brand.border}` };
const row = { color: brand.text, fontSize: 14, margin: "6px 0", display: "flex", justifyContent: "space-between" };
const hr = { borderColor: brand.border, margin: "12px 0" };
