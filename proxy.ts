import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];

// Rutas que no llevan cookie de sesión porque las llama un servidor externo,
// no un navegador — se autentican con su propio mecanismo: firma HMAC en
// /api/clickup/webhook (§3.5), Authorization: Bearer $CRON_SECRET en
// /api/cron/* (§4.3, invocado por el cron de Vercel). Sin esto, cada
// entrega/invocación real rebotaría contra /login (nunca mandan la cookie)
// y ninguna de las dos funcionaría fuera de una prueba local.
const SKIP_SESSION_AUTH_PATHS = ["/api/clickup/webhook", "/api/cron"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    SKIP_SESSION_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
