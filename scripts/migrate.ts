import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { sql } from "@/lib/db";

const DIR = join(process.cwd(), "supabase/migrations");

async function main() {
  await sql`create table if not exists _migrations (nombre text primary key, aplicada_en timestamptz not null default now())`;

  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const aplicadas = new Set((await sql<{ nombre: string }[]>`select nombre from _migrations`).map((r) => r.nombre));

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`↷ ${archivo} (ya aplicada)`);
      continue;
    }
    console.log(`→ ${archivo}`);
    const contenido = readFileSync(join(DIR, archivo), "utf-8");
    await sql.unsafe(contenido);
    await sql`insert into _migrations (nombre) values (${archivo})`;
  }

  console.log("Listo.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
