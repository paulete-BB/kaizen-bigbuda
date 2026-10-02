/**
 * Forma de `reports.contenido_json` (§3.4) — plantilla visual y estructura
 * de secciones tomadas literalmente de las plantillas reales diseñadas
 * (Informe SEO-AEO-GEO.dc.html / Informe Marketing.dc.html), no
 * reconstruidas desde la descripción del brief. Todo campo es texto libre
 * (incluso los "numéricos") porque en esta versión el equipo los escribe a
 * mano — el pre-llenado automático desde GSC/GA4/Meta (§3.14) es Fase 3
 * posterior y reemplazará estos valores por defecto, no la forma del dato.
 *
 * Las secciones "Garantías" (SEO) y el bloque de garantías del "Cierre"
 * (Ads) no viven acá: son boilerplate fijo del sistema (§3.4: "casi nunca
 * cambia entre informes") y quedan hardcodeadas en el componente de slide.
 */

import { mesLargo } from "@/lib/dates";
import type { Favorable } from "@/lib/informes/metricas-catalogo";

export interface MetricaSimple {
  valor: string;
  etiqueta: string;
  descripcion: string;
}

export interface AccionEfecto {
  accion: string;
  efecto: string;
}

export interface DetalleAccion {
  titulo: string;
  porque: string;
}

export interface PasoRoadmap {
  titulo: string;
  descripcion: string;
}

export interface InformeSeoContenido {
  portada: {
    bajada: string;
    chips: string[];
  };
  enUnaFrase: {
    principal: string;
    secundario: string;
  };
  nuestroEnfoque: {
    cita: string;
    citaAutor: string;
    contexto: string;
    decisiones: { titulo: string; descripcion: string }[];
  };
  puntoDePartida: {
    metricas: MetricaSimple[];
  };
  loQueDejamosFuncionando: {
    columnas: { titulo: string; subtitulo: string; bullets: string[] }[];
  };
  detalles: { titulo: string; items: DetalleAccion[] }[];
  resultadosNumeros: {
    cifras: MetricaSimple[];
  };
  traficoIA: {
    totalSesiones: string;
    filas: { fuente: string; sesiones: string; usuarios: string; conversiones: string }[];
  } | null;
  antesDespues: {
    pares: { etiqueta: string; antes: string; despues: string }[];
    nota: string;
  } | null;
  impactoProyectado: {
    horizontes: { etiqueta: string; titulo: string; descripcion: string }[];
    nota: string;
  };
  hojaDeRuta: {
    pasos: PasoRoadmap[];
  };
}

export interface InformeMarketingContenido {
  portada: {
    bajada: string;
    chips: string[];
  };
  comoVamosCifras: {
    /**
     * `favorable` separa el número/flecha (`deltaDireccion`, el signo literal
     * del cambio) del color que se le pinta: para métricas donde bajar es
     * bueno (costo por resultado, CPC) una flecha hacia abajo es la buena
     * noticia — mismo criterio ya establecido en `lib/data/resultados.ts`
     * (`Delta.favorable`), portado acá para el informe. Tres estados, no dos:
     * algunas métricas (inversión, costo total) no son ni buena ni mala
     * noticia por sí solas — forzarlas a verde/rojo era el bug real
     * reportado ("el costo aumentó pero eso no es ni bueno ni malo").
     */
    metricas: { etiqueta: string; valor: string; deltaTexto: string; deltaDireccion: "up" | "down"; favorable: Favorable }[];
  };
  inversionDelMes: {
    presupuesto: string;
    gasto: string;
    diaMes: string;
    pctMesTranscurrido: string;
    pctEjecutado: string;
    estado: "dentro_rango" | "sobregasto" | "subgasto";
    nota: string;
  };
  queMejoramos: {
    acciones: AccionEfecto[];
  };
  queProyectamos: {
    queEsperar: string;
    insight: string;
  };
}

export type MetricaAds = InformeMarketingContenido["comoVamosCifras"]["metricas"][number];
export type InversionCanal = InformeMarketingContenido["inversionDelMes"];

/**
 * Informe único para clientes con Meta Ads **y** Google Ads activos a la
 * vez (§3.4 → reemplaza a los dos informes separados de siempre cuando
 * aplica) — pedido explícito del usuario: "deberia haber un solo informe
 * con las 2 campañas para poder comparar los resultados e ir viendo cual
 * rinde mejor". Reusa el mismo tipo de fila de métrica
 * (`InformeMarketingContenido["comoVamosCifras"]["metricas"]`) y el mismo
 * shape de "Inversión del mes" que el formato de un solo canal — uno por
 * canal en vez de uno solo. `queMejoramos`/`queProyectamos` quedan
 * compartidos (una sola lectura de negocio, no una por canal).
 */
export interface InformeAdsCombinadoContenido {
  portada: {
    bajada: string;
    chips: string[];
  };
  comoVamosMeta: {
    metricas: MetricaAds[];
  };
  comoVamosGoogle: {
    metricas: MetricaAds[];
  };
  /**
   * Comparación directa entre canales — la funcionalidad diferencial de
   * este formato. `filas` compara solo lo que es seguro comparar entre
   * canales (volumen de resultados, inversión en su propia moneda); nunca
   * un "costo por resultado" cruzado entre monedas distintas (Meta en USD,
   * Google en CLP en esta plataforma) sin una tasa de cambio real — eso
   * sería fabricar una equivalencia que no existe. `insight` es texto
   * calculado (no IA) a partir de esos mismos números, igual criterio que
   * `insightAds` en `lib/data/resultados.ts` (regla simple, no alucinada).
   */
  comparacionCanales: {
    filas: { etiqueta: string; meta: string; google: string }[];
    insight: string;
  };
  inversionDelMes: {
    meta: InversionCanal;
    google: InversionCanal;
  };
  queMejoramos: {
    acciones: AccionEfecto[];
  };
  queProyectamos: {
    queEsperar: string;
    insight: string;
  };
}

const INVERSION_VACIA: InversionCanal = {
  presupuesto: "",
  gasto: "",
  diaMes: "",
  pctMesTranscurrido: "",
  pctEjecutado: "",
  estado: "dentro_rango",
  nota: "",
};

export function contenidoAdsCombinadoVacio(): InformeAdsCombinadoContenido {
  return {
    portada: { bajada: "", chips: ["Meta Ads", "Google Ads"] },
    comoVamosMeta: { metricas: [] },
    comoVamosGoogle: { metricas: [] },
    comparacionCanales: { filas: [], insight: "" },
    inversionDelMes: { meta: { ...INVERSION_VACIA }, google: { ...INVERSION_VACIA } },
    queMejoramos: { acciones: [] },
    queProyectamos: { queEsperar: "", insight: "" },
  };
}

export function contenidoSeoVacio(): InformeSeoContenido {
  return {
    portada: { bajada: "", chips: ["SEO", "AEO · IA", "GEO"] },
    enUnaFrase: { principal: "", secundario: "" },
    nuestroEnfoque: { cita: "", citaAutor: "", contexto: "", decisiones: [] },
    puntoDePartida: { metricas: [] },
    loQueDejamosFuncionando: {
      columnas: [
        { titulo: "SEO", subtitulo: "Que Google te elija", bullets: [] },
        { titulo: "AEO · IA", subtitulo: "Que la IA te cite", bullets: [] },
        { titulo: "GEO", subtitulo: "Que te ubiquen", bullets: [] },
      ],
    },
    detalles: [
      { titulo: "El detalle · SEO y arquitectura", items: [] },
      { titulo: "El detalle · Contenido y datos estructurados", items: [] },
    ],
    resultadosNumeros: { cifras: [] },
    traficoIA: null,
    antesDespues: null,
    impactoProyectado: { horizontes: [], nota: "" },
    hojaDeRuta: { pasos: [] },
  };
}

export function contenidoMarketingVacio(): InformeMarketingContenido {
  return {
    portada: { bajada: "", chips: ["Rendimiento"] },
    comoVamosCifras: { metricas: [] },
    inversionDelMes: {
      presupuesto: "",
      gasto: "",
      diaMes: "",
      pctMesTranscurrido: "",
      pctEjecutado: "",
      estado: "dentro_rango",
      nota: "",
    },
    queMejoramos: { acciones: [] },
    queProyectamos: { queEsperar: "", insight: "" },
  };
}

/** "Julio 2026" — usado en la portada y el pie de la plantilla de informes. */
export function fmtMesAnio(mes: number, anio: number): string {
  const nombre = mesLargo(mes);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
