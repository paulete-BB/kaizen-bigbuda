import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] ??= match[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const authRes = await fetch(`${url}/auth/v1/health`, { headers });
const authBody = await authRes.json().catch(() => null);
console.log(`GoTrue (${url}/auth/v1/health): HTTP ${authRes.status}`, authBody ?? "");

// El endpoint de introspección /rest/v1/ raíz exige secret key en el nuevo
// esquema de API keys de Supabase; para validar la publishable key se
// consulta el endpoint de datos normal contra una tabla inexistente:
// un 404 "relation not found" confirma que la key autenticó correctamente
// y llegó hasta el schema cache de PostgREST (a diferencia de un 401/403).
const probeRes = await fetch(
  `${url}/rest/v1/__kaizen_connectivity_probe__?select=*&limit=1`,
  { headers }
);
const probeBody = await probeRes.json().catch(() => null);
console.log(`PostgREST probe: HTTP ${probeRes.status}`, probeBody ?? "");

if (authRes.status !== 200) {
  console.error("GoTrue no respondió 200. Revisar NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

if (probeRes.status === 401 || probeRes.status === 403) {
  console.error("La key fue rechazada (401/403). Revisar NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

if (probeRes.status !== 404 || probeBody?.code !== "PGRST205") {
  console.error("Respuesta inesperada de PostgREST, no se pudo confirmar autenticación.");
  process.exit(1);
}

console.log("Conexión OK: la URL del proyecto y la publishable key son válidas y autentican correctamente.");
