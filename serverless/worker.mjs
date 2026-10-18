// Optional Cloudflare Worker. Configure ORS_API_KEY as a secret, ALLOWED_ORIGIN
// as the exact Pages origin, and RATE_LIMITER as a Cloudflare rate-limit binding.
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };
    const reply = (message, status) =>
      new Response(JSON.stringify({ error: message }), { status, headers });
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN)
      return reply("Origin not allowed", 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply("POST required", 405);
    if (!env.RATE_LIMITER || !env.ORS_API_KEY)
      return reply("Provider not configured", 503);
    const limited = await env.RATE_LIMITER.limit({
      key: request.headers.get("CF-Connecting-IP") || "unknown",
    });
    if (!limited.success) return reply("Rate limit reached", 429);
    try {
      const raw = await request.text();
      if (raw.length > 10000) return reply("Too large", 413);
      const { locations } = JSON.parse(raw);
      if (
        !Array.isArray(locations) ||
        locations.length < 2 ||
        locations.length > 22 ||
        locations.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            !p.every(Number.isFinite) ||
            Math.abs(p[0]) > 180 ||
            Math.abs(p[1]) > 90,
        )
      )
        return reply("Invalid coordinates", 400);
      const response = await fetch(
        "https://api.openrouteservice.org/v2/matrix/driving-car",
        {
          method: "POST",
          headers: {
            Authorization: env.ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locations,
            metrics: ["duration", "distance"],
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok) return reply("Routing unavailable", 502);
      const { durations, distances } = await response.json();
      return new Response(JSON.stringify({ durations, distances }), {
        headers: { ...headers, "Cache-Control": "no-store" },
      });
    } catch {
      return reply("Unable to route", 502);
    }
  },
};
