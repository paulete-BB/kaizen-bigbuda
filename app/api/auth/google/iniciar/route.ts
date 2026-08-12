import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { construirUrlAutorizacion, generarPkce } from "@/lib/google/oauth";

const COOKIE = "google_oauth_pkce";

/** Arranca el flujo Authorization Code + PKCE (§3.14) — solo admin, se llama desde /ajustes. */
export async function GET(req: Request) {
  await requireAdmin();

  try {
    const pkce = generarPkce();
    const url = construirUrlAutorizacion(pkce);

    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE, JSON.stringify({ verifier: pkce.verifier, state: pkce.state }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    return res;
  } catch (e) {
    const destino = new URL("/ajustes", req.url);
    destino.searchParams.set("google", "error");
    destino.searchParams.set("google_error", e instanceof Error ? e.message : "Error desconocido");
    return NextResponse.redirect(destino);
  }
}
