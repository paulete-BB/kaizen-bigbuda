import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/passwords";

/**
 * Crea un usuario (no hay pantalla de administración de usuarios).
 * Uso: npm run usuario:crear -- <email> "<Nombre>" <admin|miembro|lector> [password]
 * Sin password genera una al azar y la imprime una sola vez. Requiere la
 * migración 0024 aplicada si el rol es `lector`.
 */
async function main() {
  const [email, nombre, rol, passwordArg] = process.argv.slice(2);
  if (!email || !nombre || !["admin", "miembro", "lector"].includes(rol ?? "")) {
    console.error('Uso: npm run usuario:crear -- <email> "<Nombre>" <admin|miembro|lector> [password]');
    process.exit(1);
  }
  const password = passwordArg ?? Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  const iniciales = nombre.trim().slice(0, 2).toUpperCase();
  await sql`
    insert into users (nombre, email, rol, iniciales, color, password_hash)
    values (${nombre}, ${email.toLowerCase()}, ${rol}, ${iniciales}, '#64748b', ${await hashPassword(password)})
  `;
  console.log(`Usuario creado: ${email} (${rol})${passwordArg ? "" : `\nContraseña: ${password}`}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
