import { describe, expect, it } from "vitest";
import { scrubEvent, sentryOptions, stripQuery } from "./sentry";

describe("scrubEvent", () => {
  it("removes tokens, cookies, bodies, auth headers and user identity", () => {
    const event = scrubEvent({
      request: {
        url: "https://agendo.mx/restablecer?token=SECRET",
        query_string: "token=SECRET",
        cookies: { "better-auth.session_token": "abc" },
        data: { phone: "+525512345678" },
        headers: { cookie: "x", Authorization: "Bearer y", "CF-Connecting-IP": "1.2.3.4", accept: "text/html" },
      },
      user: { ip_address: "1.2.3.4", email: "juan@example.com" },
    });
    expect(event.request?.url).toBe("https://agendo.mx/restablecer");
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
