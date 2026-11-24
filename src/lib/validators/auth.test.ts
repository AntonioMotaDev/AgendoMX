import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, registerSchema } from "./auth";

describe("auth validators", () => {
  it("normalizes the email (trim + lowercase)", () => {
    const parsed = loginSchema.parse({ email: "  Juan@Example.COM ", password: "x" });
    expect(parsed.email).toBe("juan@example.com");
  });

  it("rejects malformed emails with a friendly message", () => {
    const result = forgotPasswordSchema.safeParse({ email: "juan@" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/correo/i);
  });

  it("requires 10+ character passwords on sign-up but not on login", () => {
    expect(registerSchema.safeParse({ name: "Juan", email: "j@example.com", password: "corta" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Juan", email: "j@example.com", password: "larga-de-verdad" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "j@example.com", password: "x" }).success).toBe(true);
  });

  it("requires a name", () => {
    expect(registerSchema.safeParse({ name: "  ", email: "j@example.com", password: "larga-de-verdad" }).success).toBe(false);
  });
});
