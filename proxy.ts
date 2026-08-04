import { NextResponse, type NextRequest } from "next/server";

// TODO(auth): reemplazado en el bloque de auth (lib/auth/session.ts) por la
// verificación real de la cookie de sesión. Passthrough temporal para no
// romper el build mientras se construye el motor de scheduling.
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
