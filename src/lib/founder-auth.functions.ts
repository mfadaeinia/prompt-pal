import { createServerFn } from "@tanstack/react-start";

export const verifyFounderPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => {
    if (typeof data?.password !== "string" || data.password.length > 200) {
      throw new Error("Invalid input");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const expected = process.env.FOUNDER_PASSWORD;
    if (!expected) {
      throw new Error("FOUNDER_PASSWORD not configured");
    }
    // Constant-time-ish compare
    const a = data.password;
    const b = expected;
    let mismatch = a.length === b.length ? 0 : 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    if (mismatch !== 0) {
      return { ok: false as const };
    }
    return { ok: true as const, token: expected };
  });
