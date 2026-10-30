import { obtenerAccessTokenGoogle } from "@/lib/google/oauth";

/**
 * Cliente REST de la API de Google Ads (solo lectura, `searchStream` + GAQL).
 *
 * Cuentas de los clientes: el usuario de Google conectado en /ajustes puede tener acceso directo a la
 * cuenta (invitado como usuario) o a través de la MCC de Bigbuda (cuenta vinculada). Con acceso directo
 * la llamada va sin `login-customer-id`; con una cuenta que solo se alcanza vía MCC hay que mandar el ID
 * de la MCC. Se prueba primero sin cabecera y, si Google responde permiso denegado, se reintenta con la
 * MCC; se recuerda cuál funcionó por cuenta mientras viva el proceso.
 *
 * Sin developer token: el nivel de acceso lo da el proyecto de Google Cloud de las credenciales OAuth. La versión de la API se configura con `GOOGLE_ADS_API_VERSION` (Google retira versiones cada ~12 meses:
 * revisar developers.google.com/google-ads/api/docs/sunset-dates).
 */

const VERSION_POR_DEFECTO = "v23";
/** ID de la MCC de Bigbuda (sin guiones). Se puede cambiar con `GOOGLE_ADS_LOGIN_CUSTOMER_ID`. */
const MCC_POR_DEFECTO = "9489902568";

export type FilaGoogleAds = Record<string, unknown>;

export class ErrorGoogleAds extends Error {
  constructor(
    mensaje: string,
    readonly codigo: string,
    readonly permisoDenegado = false,
  ) {
    super(mensaje);
  }
}

/** Acepta "738-056-4660" o "7380564660"; devuelve solo los 10 dígitos, o null si no es un ID válido. */
export function normalizarCustomerId(raw: string): string | null {
  const digitos = raw.replace(/\D/g, "");
  return digitos.length === 10 ? digitos : null;
}

const MENSAJES: Record<string, string> = {
  DEVELOPER_TOKEN_NOT_APPROVED: "El proyecto de Google Cloud todavía solo tiene acceso de prueba a la API de Google Ads (solo cuentas de prueba). Revisa el nivel de acceso en la consola de Google Cloud: debe ser Explorador o superior.",
  DEVELOPER_TOKEN_INVALID: "Google rechazó el developer token: Kaizen ya no lo envía.",
  DEVELOPER_TOKEN_PROHIBITED: "Google no permite usar este proyecto de Google Cloud con la API de Google Ads.",
  USER_PERMISSION_DENIED: "El usuario de Google conectado no tiene acceso a esta cuenta de Google Ads (ni directo ni por la MCC de Bigbuda).",
  CUSTOMER_NOT_FOUND: "No existe una cuenta de Google Ads con ese ID.",
  CUSTOMER_NOT_ENABLED: "La cuenta de Google Ads está cancelada o no está habilitada.",
  OAUTH_TOKEN_INVALID: "La conexión con Google venció: vuelve a conectar Google en /ajustes.",
  ACCESS_TOKEN_SCOPE_INSUFFICIENT: "La conexión de Google no incluye el permiso de Google Ads: vuelve a conectar Google en /ajustes.",
  SERVICE_DISABLED: "La API de Google Ads no está habilitada en el proyecto de Google Cloud.",
};

interface CuerpoError {
  error?: { code?: number; status?: string; message?: string; details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[] };
}

/** Convierte la respuesta de error de Google Ads en un mensaje claro en español. */
export function traducirErrorGoogleAds(status: number, cuerpo: unknown): ErrorGoogleAds {
  const e = (cuerpo as CuerpoError | undefined)?.error;
  const codigos = (e?.details ?? []).flatMap((d) => (d.errors ?? []).flatMap((x) => Object.values(x.errorCode ?? {})));
  const reasons = (e?.details as unknown as { reason?: string }[] | undefined)?.map((d) => d.reason).filter(Boolean) as string[] | undefined;
  const codigo = [...codigos, ...(reasons ?? [])].find((c) => c in MENSAJES) ?? codigos[0] ?? e?.status ?? String(status);
  const permisoDenegado = codigo === "USER_PERMISSION_DENIED";
  const mensaje = MENSAJES[codigo] ?? e?.message ?? `Google Ads respondió ${status}`;
  return new ErrorGoogleAds(mensaje, codigo, permisoDenegado);
}

// Qué forma de acceso funcionó para cada cuenta (memoria del proceso).
const accesoPorCuenta = new Map<string, "directo" | "mcc">();

async function llamar(customerId: string, query: string, loginCustomerId: string | null): Promise<FilaGoogleAds[]> {
  const accessToken = await obtenerAccessTokenGoogle();
  const version = process.env.GOOGLE_ADS_API_VERSION ?? VERSION_POR_DEFECTO;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  // Sin cabecera developer-token: desde septiembre de 2026 Google ya no los usa (el acceso depende del proyecto de
  // Google Cloud de las credenciales OAuth) y la rechazará en una versión futura de la API.
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(`https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  });
  const cuerpo = (await res.json().catch(() => undefined)) as unknown;
  if (!res.ok) throw traducirErrorGoogleAds(res.status, Array.isArray(cuerpo) ? cuerpo[0] : cuerpo);

  // searchStream devuelve un arreglo de lotes, cada uno con sus `results`.
  const lotes = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]) as { results?: FilaGoogleAds[] }[];
  return lotes.flatMap((l) => l?.results ?? []);
}

/** Ejecuta una consulta GAQL sobre la cuenta de un cliente. */
export async function consultarGoogleAds(customerId: string, query: string): Promise<FilaGoogleAds[]> {
  const mcc = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? MCC_POR_DEFECTO).replace(/\D/g, "");
  const conocido = accesoPorCuenta.get(customerId);

  if (conocido === "mcc") return llamar(customerId, query, mcc);
  try {
    const filas = await llamar(customerId, query, null);
    accesoPorCuenta.set(customerId, "directo");
    return filas;
  } catch (e) {
    if (!(e instanceof ErrorGoogleAds) || !e.permisoDenegado || conocido === "directo") throw e;
    const filas = await llamar(customerId, query, mcc);
    accesoPorCuenta.set(customerId, "mcc");
    return filas;
  }
}

export interface ResumenCuentaAds {
  id: string;
  nombre: string;
  moneda: string;
  zonaHoraria: string;
}

/** Prueba de conexión: lee los datos básicos de la cuenta. Falla con un mensaje claro si algo de la cadena (token, permiso, acceso) no está bien. */
export async function probarConexionGoogleAds(customerId: string): Promise<ResumenCuentaAds> {
  const filas = await consultarGoogleAds(customerId, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1");
  const c = (filas[0]?.customer ?? {}) as { id?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string };
  return { id: String(c.id ?? customerId), nombre: c.descriptiveName ?? "(sin nombre)", moneda: c.currencyCode ?? "", zonaHoraria: c.timeZone ?? "" };
}
