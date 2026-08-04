"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyPassword } from "./passwords";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "./session";

export interface LoginResult {
  error: string;
}

export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu email y tu contraseña." };
  }

  const rows = await sql<{ id: string; nombre: string; rol: "admin" | "miembro"; password_hash: string }[]>`
    select id, nombre, rol, password_hash from users where email = ${email}
  `;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Email o contraseña incorrectos." };
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = signSession({ userId: user.id, rol: user.rol, nombre: user.nombre, exp });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect("/dashboard");
}

export async function loginFormAction(_prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  return login(formData);
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
