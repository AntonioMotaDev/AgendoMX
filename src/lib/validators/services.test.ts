import { describe, expect, it } from "vitest";
import { serviceFormSchema } from "./services";

const valid = {
  name: " Corte clásico ",
  description: "",
  price: "180",
  priceIsFrom: false,
  durationMin: 45,
  bufferAfterMin: 10,
  isBookableOnline: true,
  isActive: true,
};

describe("serviceFormSchema", () => {
  it("normalizes name, price and an empty description", () => {
    expect(serviceFormSchema.parse(valid)).toMatchObject({ name: "Corte clásico", price: 18000, description: null });
  });

  it("keeps a real description and trims it", () => {
    expect(serviceFormSchema.parse({ ...valid, description: "  Con lavado  " }).description).toBe("Con lavado");
    expect(serviceFormSchema.safeParse({ ...valid, description: "x".repeat(281) }).success).toBe(false);
  });

  it("allows a hidden price but not 'desde' without a price", () => {
    expect(serviceFormSchema.parse({ ...valid, price: "" }).price).toBeNull();
    const result = serviceFormSchema.safeParse({ ...valid, price: "", priceIsFrom: true });
    expect(result.error?.issues[0]).toMatchObject({ path: ["price"] });
    expect(serviceFormSchema.parse({ ...valid, priceIsFrom: true }).priceIsFrom).toBe(true);
  });

  it("enforces the same bounds as the database", () => {
    expect(serviceFormSchema.safeParse({ ...valid, durationMin: 4 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, durationMin: 721 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, durationMin: Number.NaN }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, bufferAfterMin: -5 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, bufferAfterMin: 241 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, bufferAfterMin: 7.5 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });
});
