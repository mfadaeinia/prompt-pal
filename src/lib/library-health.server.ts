export function requireFounder(token: string) {
  const expected = process.env.FOUNDER_PASSWORD;
  if (!expected || token !== expected) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
