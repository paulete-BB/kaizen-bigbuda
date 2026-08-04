import postgres from "postgres";

declare global {
  var __kaizenSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Cliente Postgres directo (sin PostgREST/GoTrue) sobre DATABASE_URL.
 * En producción DATABASE_URL es la connection string del proyecto Supabase
 * real — mismo código, solo cambia el valor del env var.
 *
 * `date` se devuelve como string 'YYYY-MM-DD' en vez de un Date en hora
 * local del proceso — evita corrimientos de zona horaria y el bug de
 * interpolar un Date crudo (.toString()) en un template string.
 */
export const sql = globalThis.__kaizenSql ?? postgres(process.env.DATABASE_URL!, {
  max: 10,
  types: {
    date: {
      to: 1082,
      from: [1082],
      serialize: (x: string) => x,
      parse: (x: string) => x,
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__kaizenSql = sql;
}
