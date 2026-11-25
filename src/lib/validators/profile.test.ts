import { describe, expect, it } from "vitest";
import { formatMxPhoneForInput } from "@/lib/phone";
import { bookingSettingsSchema, profileInfoSchema, slugChangeSchema, socialLinksSchema } from "./profile";

const base = { name: " Barbería Juan ", category: "barbershop", categoryOther: null, state: "Jalisco", city: " GDL " };

describe("profileInfoSchema", () => {
  it("trims, normalizes phones to E.164, lowercases the email and nulls empty optionals", () => {
    const data = profileInfoSchema.parse({
      ...base,
      description: "  Cortes con precisión  ",
      address: "",
      mapsUrl: "maps.app.goo.gl/AbC123",
      phone: "55 1234 5678",
      whatsapp: "+52 1 55 8765 4321",
      email: " Juan@Example.COM ",
    });
    expect(data).toMatchObject({
      name: "Barbería Juan",
      city: "GDL",
      description: "Cortes con precisión",
      address: null,
      mapsUrl: "https://maps.app.goo.gl/AbC123",
      phone: "+525512345678",
      whatsapp: "+525587654321",
      email: "juan@example.com",
    });
  });

  it("accepts everything optional left empty", () => {
    const data = profileInfoSchema.parse({ ...base, description: "", address: null, mapsUrl: "", phone: "", whatsapp: undefined, email: "  " });
    expect(data).toMatchObject({ description: null, address: null, mapsUrl: null, phone: null, whatsapp: null, email: null });
  });

  it("explains each invalid field", () => {
    const messages = (input: object) => profileInfoSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => String(i.path[0])) ?? [];
    expect(messages({ phone: "123" })).toContain("phone");
    expect(messages({ whatsapp: "+1 202 555 0100" })).toContain("whatsapp");
    expect(messages({ email: "juan@" })).toContain("email");
    expect(messages({ mapsUrl: "https://evil.com/x" })).toContain("mapsUrl");
    expect(messages({ description: "x".repeat(501) })).toContain("description");
    expect(messages({ address: "x".repeat(161) })).toContain("address");
  });

  it("shares the 'Otro' rule with onboarding", () => {
    expect(profileInfoSchema.safeParse({ ...base, category: "other", categoryOther: "" }).error?.issues[0]?.path).toEqual(["categoryOther"]);
    expect(profileInfoSchema.parse({ ...base, category: "other", categoryOther: " Pilates " }).categoryOther).toBe("Pilates");
    expect(profileInfoSchema.parse({ ...base, category: "nails", categoryOther: "Pilates" }).categoryOther).toBeNull();
  });
});

describe("formatMxPhoneForInput", () => {
  it("round-trips with the validator", () => {
    expect(formatMxPhoneForInput("+525512345678")).toBe("55 1234 5678");
    expect(formatMxPhoneForInput(null)).toBe("");
    expect(profileInfoSchema.parse({ ...base, phone: formatMxPhoneForInput("+525512345678") }).phone).toBe("+525512345678");
  });
});

describe("socialLinksSchema", () => {
  it("normalizes each network and nulls the empty ones", () => {
    const data = socialLinksSchema.parse({ instagram: "@barberia_juan", facebook: "", tiktok: undefined, youtube: "youtube.com/@juan", twitter: "juan", linkedin: "https://www.linkedin.com/company/forma01" });
    expect(data).toEqual({
      instagram: "https://www.instagram.com/barberia_juan",
      facebook: null,
      tiktok: null,
      youtube: "https://youtube.com/@juan",
      twitter: "https://x.com/juan",
      linkedin: "https://www.linkedin.com/company/forma01",
    });
  });

  it("points at the failing network", () => {
    const error = socialLinksSchema.safeParse({ instagram: "https://evil.com/x", linkedin: "forma01" }).error;
    expect(error?.issues.map((i) => i.path[0]).sort()).toEqual(["instagram", "linkedin"]);
    expect(error?.issues.find((i) => i.path[0] === "linkedin")?.message).toMatch(/enlace completo/);
  });
});

describe("slugChangeSchema", () => {
  it("requires acknowledging the consequences and a valid slug", () => {
    expect(slugChangeSchema.safeParse({ slug: "nuevo-link", acknowledge: true }).success).toBe(true);
    expect(slugChangeSchema.safeParse({ slug: "nuevo-link", acknowledge: false }).error?.issues[0]?.path).toEqual(["acknowledge"]);
    expect(slugChangeSchema.safeParse({ slug: "login", acknowledge: true }).success).toBe(false);
  });
});

describe("bookingSettingsSchema", () => {
  const valid = { confirmationMode: "auto", pendingExpiryHours: 24, bookingLeadTimeMin: 60, bookingWindowDays: 30, cancellationMinHours: 4, cancellationPolicyText: "" };

  it("accepts the defaults and nulls an empty policy", () => {
    expect(bookingSettingsSchema.parse(valid)).toMatchObject({ confirmationMode: "auto", cancellationPolicyText: null });
  });

  it("enforces the database ranges", () => {
    for (const bad of [
      { pendingExpiryHours: 0 }, { pendingExpiryHours: 169 }, { bookingLeadTimeMin: -1 }, { bookingWindowDays: 0 },
      { bookingWindowDays: 366 }, { cancellationMinHours: -1 }, { cancellationMinHours: 169 }, { confirmationMode: "maybe" },
      { cancellationPolicyText: "x".repeat(281) }, { bookingWindowDays: 7.5 }, { bookingWindowDays: Number.NaN },
    ]) {
      expect(bookingSettingsSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
  });
});
