import type { APIRoute } from "astro";
import { fetchCompletedEcts } from "@/lib/koski";

// Server-rendered (serverless) — this route reads the secret Koski endpoint at
// request time. It must not be prerendered.
export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const completedEcts = await fetchCompletedEcts();

    return new Response(JSON.stringify({ completedEcts }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache at the edge: serve cached value for 1h, then revalidate in the
        // background while still serving the stale value. Keeps the Koski
        // endpoint from being hit on every page view.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[koski] Failed to fetch completed ECTS:", error);

    // Degrade gracefully: the client treats a null value as "no update" and keeps
    // whatever was rendered at build time.
    return new Response(JSON.stringify({ completedEcts: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
};
