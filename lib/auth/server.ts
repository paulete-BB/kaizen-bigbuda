import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Para toda acción que escribe: el rol `lector` (solo lectura) no puede. En vez de
 * fallar con un error genérico, lo lleva a una página que explica por qué.
 */
export async function requireWriter(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.rol === "lector") redirect("/solo-lectura");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.rol !== "admin") redirect("/dashboard");
  return session;
}
