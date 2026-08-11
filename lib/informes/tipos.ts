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
    metricas: { etiqueta: string; valor: string; deltaTexto: string; deltaDireccion: "up" | "down" }[];
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

const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "Julio 2026" — usado en la portada y el pie de la plantilla de informes. */
export function fmtMesAnio(mes: number, anio: number): string {
  const nombre = MESES_LARGO[mes - 1] ?? "";
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
