export const PASSWORD = "contrasena-segura-123";

export const OWNER_A = {
  email: "duena@e2e.test",
  name: "Dueña Uno",
  business: "Barbería E2E",
  slug: "e2e-barberia",
  mode: "auto" as const,
  services: [
    { name: "Corte de cabello", minutes: 45, priceCents: 18000, buffer: 15 },
    { name: "Arreglo de barba", minutes: 30, priceCents: 10000, buffer: 0 },
  ],
};

/** Approves every request by hand (manual mode), so bookings arrive as pending. */
export const OWNER_B = {
  email: "dueno@e2e.test",
  name: "Dueño Dos",
  business: "Estudio E2E",
  slug: "e2e-estudio",
  mode: "manual" as const,
  services: [{ name: "Consulta", minutes: 60, priceCents: 50000, buffer: 0 }],
};
