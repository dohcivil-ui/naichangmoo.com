import { describe, expect, it } from "vitest";
import { isAuthRuntimeConfigured } from "@/lib/auth-availability";

describe("isAuthRuntimeConfigured", () => {
  it("returns false when a pilot environment has no database settings", () => {
    expect(isAuthRuntimeConfigured({ BETTER_AUTH_SECRET: "safe-preview-secret", BETTER_AUTH_URL: "https://preview.example.com" })).toBe(false);
  });

  it("returns true only when the database, secret and base URL are all configured", () => {
    expect(isAuthRuntimeConfigured({ DATABASE_URL: "postgres://example", BETTER_AUTH_SECRET: "safe-preview-secret", BETTER_AUTH_URL: "https://app.example.com" })).toBe(true);
  });
});
