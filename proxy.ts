import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];

// Rutas que no llevan cookie de sesión porque las llama un servidor externo,
// no un navegador — se autentican con su propio mecanismo (firma HMAC en
// /api/clickup/webhook, §3.5). Sin esto, cada entrega real de ClickUp
// rebotaría contra /login (nunca manda la cookie) y el webhook no
// funcionaría nunca fuera de esta prueba local.
const SKIP_SESSION_AUTH_PATHS = ["/api/clickup/webhook"];

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
