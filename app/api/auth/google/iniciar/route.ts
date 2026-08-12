import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { construirUrlAutorizacion, generarPkce } from "@/lib/google/oauth";

const COOKIE = "google_oauth_pkce";

/** Arranca el flujo Authorization Code + PKCE (§3.14) — solo admin, se llama desde /ajustes. */
export async function GET() {
  await requireAdmin();

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
}
