import postgres from "postgres";

declare global {
  var __kaizenSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Cliente Postgres directo (sin PostgREST/GoTrue) sobre DATABASE_URL.
 * En producción DATABASE_URL es la connection string del proyecto Supabase
 * real — mismo código, solo cambia el valor del env var.
 */
export const sql = globalThis.__kaizenSql ?? postgres(process.env.DATABASE_URL!, {
  max: 10,
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__kaizenSql = sql;
}
