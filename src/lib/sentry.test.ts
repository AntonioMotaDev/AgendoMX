import { describe, expect, it } from "vitest";
import { isClientNoise, scrubEvent, sentryOptions, stripQuery } from "./sentry";

describe("scrubEvent", () => {
  it("removes tokens, cookies, bodies, auth headers and user identity", () => {
    const event = scrubEvent({
      request: {
        url: "https://agendomx.com/restablecer?token=SECRET",
        query_string: "token=SECRET",
        cookies: { "better-auth.session_token": "abc" },
        data: { phone: "+525512345678" },
        headers: { cookie: "x", Authorization: "Bearer y", "CF-Connecting-IP": "1.2.3.4", accept: "text/html" },
      },
      user: { ip_address: "1.2.3.4", email: "juan@example.com" },
    });
    expect(event.request?.url).toBe("https://agendomx.com/restablecer");
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.headers).toEqual({ accept: "text/html" });
    expect(event.user).toBeUndefined();
  });

  it("handles events without a request", () => {
    expect(scrubEvent({})).toEqual({});
  });
});

describe("sentryOptions", () => {
  it("is disabled without a DSN", () => {
    const options = sentryOptions({});
    expect(options.dsn).toBeUndefined();
    expect(options.environment).toBe("production");
  });
  it("stripQuery keeps the path", () => {
    expect(stripQuery("/a/b?x=1")).toBe("/a/b");
    expect(stripQuery("/a/b")).toBe("/a/b");
  });
});

describe("isClientNoise", () => {
  it("drops errors a visitor can trigger on purpose", () => {
    expect(isClientNoise("2026-11-24T19:53:54Z ERROR [Better Auth]: Invalid origin: https://evil.example")).toBe(true);
    expect(isClientNoise("[Better Auth]: Invalid email or password")).toBe(true);
  });
  it("keeps real failures", () => {
    expect(isClientNoise("[Better Auth]: connection terminated unexpectedly")).toBe(false);
    expect(isClientNoise("health check failed")).toBe(false);
    expect(isClientNoise(undefined)).toBe(false);
  });
});
