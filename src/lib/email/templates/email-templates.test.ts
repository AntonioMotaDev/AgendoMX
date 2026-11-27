import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/components";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { ActionEmail } from "./action-email";
import { BookingEmail } from "./booking-email";

const details = [
  { label: "Cuándo", value: "sábado, 28 de noviembre · 4:30 p.m.", emphasis: true },
  { label: "Servicio", value: "Corte clásico" },
  { label: "Dónde", value: "Av. Reforma 120, CDMX" },
];
const booking = (hero: "confirmed" | "pending" | "cancelled" | "reminder", extra = {}) =>
  createElement(BookingEmail, { preview: "Vista previa", greeting: "Hola, Ana", body: "Tu cita en Barbería Juan quedó confirmada.", details, cta: "Ver mi cita", url: "https://agendomx.com/cita/x", note: "Puedes cancelar hasta 4 horas antes.", hero, ...extra });
const action = (hero: "verify" | "reset") =>
  createElement(ActionEmail, { preview: "Vista previa", greeting: "Hola, Antonio", body: "Para terminar de crear tu cuenta, confirma tu correo.", cta: "Confirmar correo", url: "https://agendomx.com/verify", expires: "El enlace es válido por 24 horas.", ignore: "Si tú no creaste esta cuenta, ignora este mensaje.", hero });

const samples = {
  "booking-confirmed": booking("confirmed"),
  "booking-pending": booking("pending"),
  "booking-cancelled": booking("cancelled"),
  "booking-reminder": booking("reminder"),
  "action-verify": action("verify"),
  "action-reset": action("reset"),
};

vi.mock("server-only", () => ({}));

describe("email templates", () => {
  for (const [name, element] of Object.entries(samples)) {
    it(`${name} carries the isotipo, an illustration, the signature and the tagline`, async () => {
      const html = await render(element);
      expect(html).toContain("/brand/email/isotipo.png");
      expect(html).toMatch(/\/brand\/email\/hero-[a-z]+\.png/);
      expect(html).toMatch(/\/brand\/email\/hero-[a-z]+-dark\.png/);
      expect(html).toContain(copy.email.signatureName);
      expect(html).toContain(copy.email.tagline);
      expect(html).toContain(copy.email.credit);
      expect(html).toContain("prefers-color-scheme: dark");
      // Dev aid: EMAIL_PREVIEW_DIR=/some/dir pnpm vitest run email-templates writes each email as HTML.
      const dir = process.env.EMAIL_PREVIEW_DIR;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.html`), html);
      }
    });
  }

  it("shows the date in its own highlighted block and does not repeat it in the rows", async () => {
    const html = await render(samples["booking-confirmed"]);
    expect(html.match(/sábado, 28 de noviembre/g)).toHaveLength(1);
    expect(html).toContain("border-left");
  });
});
