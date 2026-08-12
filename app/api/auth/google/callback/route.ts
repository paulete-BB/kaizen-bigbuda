import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { intercambiarCodigoPorTokens } from "@/lib/google/oauth";

const COOKIE = "google_oauth_pkce";

export async function GET(req: NextRequest) {
  await requireAdmin();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieRaw = req.cookies.get(COOKIE)?.value;
  const cookieData = cookieRaw ? (JSON.parse(cookieRaw) as { verifier: string; state: string }) : null;

  const destino = new URL("/ajustes", url.origin);

  if (errorParam) {
    destino.searchParams.set("google", "error");
    destino.searchParams.set("google_error", errorParam);
  } else if (!code || !state || !cookieData || state !== cookieData.state) {
    destino.searchParams.set("google", "error");
    destino.searchParams.set("google_error", "state_invalido");
  } else {
    const resultado = await intercambiarCodigoPorTokens(code, cookieData.verifier);
    if (!resultado.ok) {
      destino.searchParams.set("google", "error");
      destino.searchParams.set("google_error", resultado.error ?? "desconocido");
    } else {
      destino.searchParams.set("google", "conectado");
    }
  }

  const res = NextResponse.redirect(destino);
  res.cookies.delete(COOKIE);
  return res;
}
