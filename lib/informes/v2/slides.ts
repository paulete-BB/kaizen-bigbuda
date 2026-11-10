/**
 * Slides del informe v2: diseño del PDF de referencia (fondo crema, tarjetas
 * blancas, números grandes, deltas verde/rojo, caja oscura "lo que viene")
 * pero en apaisado 1920×1080 como el resto de los informes. Se arma con los
 * mismos datos de Resultados guardados en `contenido.datos`; las secciones
 * sin datos (integración sin configurar, API caída sin caché) se omiten.
 */
import { esc } from "@/lib/informes/render";
import { fmtDeltaPct } from "@/lib/resultados-formato";
import { mesLargo, parseIso } from "@/lib/dates";
import { colorFuenteIA } from "@/lib/resultados-colores-ia";
import type { Delta, FilaCampana, KpiResultado, SeccionAeo, SeccionGoogleAds, SeccionMeta, SeccionSeo } from "@/lib/data/resultados";
import type { ReportTipo } from "@/lib/data/informes";
import type { InformeV2Contenido } from "@/lib/informes/v2/tipos";
import { barraHorizontal, COLOR, fechaCorta, fmtNum, leyendaLineas, svgLineas } from "@/lib/informes/v2/graficos";

export interface ContextoV2 {
  clienteNombre: string;
  clienteEmpresa: string;
  contactoNombre: string;
  mesAnioLabel: string;
  tipo: ReportTipo;
  contenido: InformeV2Contenido;
  logoSrc: string;
}

interface SlideDef {
  seccion: string;
  html: string;
  /** La portada lleva su propio encabezado, sin la línea de sección. */
  portada?: boolean;
}

/* ───────────────────────── estilos ───────────────────────── */

export const ESTILOS_V2 = `
.v2-canvas *{box-sizing:border-box;}
.v2-slide{width:1920px;height:1080px;position:relative;overflow:hidden;background:#f7f5f0;color:#1f1d19;font-family:var(--font-onest),'Helvetica Neue',Helvetica,Arial,sans-serif;flex-shrink:0;}
.v2-head{position:absolute;left:104px;right:104px;top:44px;height:84px;border-bottom:2px solid #dcd7ca;display:flex;justify-content:space-between;align-items:flex-start;}
.v2-head img{height:46px;display:block;}
.v2-head span{font-size:24px;font-weight:700;color:#7a7364;padding-top:8px;}
.v2-body{position:absolute;left:104px;right:104px;top:164px;bottom:128px;}
.v2-foot{position:absolute;left:104px;right:104px;bottom:40px;border-top:2px solid #e3dfd3;padding-top:20px;display:flex;justify-content:space-between;font-size:20px;color:#7a7364;}
.v2-foot b{color:#1f1d19;}
.v2-t{font-size:58px;line-height:1.06;font-weight:800;letter-spacing:-0.025em;margin:0 0 12px;max-width:1500px;}
.v2-s{font-size:26px;line-height:1.4;color:#4a463d;margin:0 0 26px;max-width:1350px;}
.v2-card{background:#fff;border:2px solid #e7e3d9;border-radius:22px;padding:26px 30px;}
.v2-lbl{font-size:20px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a1a;}
.v2-nota{font-size:21px;line-height:1.4;color:#4a463d;}
.v2-nota b{color:#8a6a1a;}
.v2-tabla{width:100%;border-collapse:collapse;font-size:22px;}
.v2-tabla th{font-size:18px;font-weight:700;color:#7a7364;text-align:right;padding:0 0 14px 18px;border-bottom:2px solid #ece8de;}
.v2-tabla th:first-child,.v2-tabla td:first-child{text-align:left;padding-left:0;}
.v2-tabla td{padding:14px 0 14px 18px;border-bottom:2px solid #f0ece3;text-align:right;font-variant-numeric:tabular-nums;color:#4a463d;}
.v2-tabla tr:last-child td{border-bottom:0;}
.v2-tabla td:first-child{color:#1f1d19;font-weight:700;}
.v2-tabla td.fuerte{color:#1f1d19;font-weight:800;}
@media print{
  @page{size:1920px 1080px;margin:0;}
  html,body,.v2-canvas,.v2-slide{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}
  body{margin:0;}
  .v2-slide:not(:last-child){page-break-after:always;break-after:page;}
  .informe-noprint{display:none !important;}
}
`;

/* ───────────────────────── helpers ───────────────────────── */

const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")} %`;
// Montos como "$1.234", sin código de moneda.
const fmtMoneda = (n: number) => `$${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })}`;

export function fechaLarga(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} de ${mesLargo(d.getMonth() + 1)} de ${d.getFullYear()}`;
}

export function diasEntreIso(desde: string, hasta: string): number {
  return Math.round((parseIso(hasta).getTime() - parseIso(desde).getTime()) / 86400000) + 1;
}

/** "28 de septiembre al 25 de octubre de 2026". */
export function rangoLargo(desde: string, hasta: string): string {
  const a = parseIso(desde);
  const b = parseIso(hasta);
  const izq = a.getFullYear() === b.getFullYear() ? `${a.getDate()} de ${mesLargo(a.getMonth() + 1)}` : fechaLarga(desde);
  return `${izq} al ${fechaLarga(hasta)}`;
}

const NOTAS_KPI: Record<string, string> = {
  Clics: "Más personas llegaron a tu sitio al buscar en Google.",
  Impresiones: "Veces que una página tuya se mostró en los resultados de Google.",
  CTR: "De cada 100 veces que apareces, cuántas personas entran a tu sitio.",
  "Posición media": "El puesto en que apareces; mientras más bajo el número, más arriba estás.",
  "Conversiones orgánicas": "Visitas desde Google que dejaron un contacto o una compra.",
  "Tasa de conversión": "De cada 100 visitas, cuántas terminaron en un contacto o una compra.",
  Inversión: "Lo que se invirtió en anuncios durante el período.",
  Resultados: "Contactos, mensajes o compras que generaron tus anuncios.",
  "Costo por resultado": "Cuánto cuesta conseguir cada resultado.",
  "Costo por conversión": "Cuánto cuesta conseguir cada conversión.",
  CTR_ADS: "De cada 100 veces que se mostró un anuncio, cuántas personas hicieron clic.",
  Alcance: "Personas distintas que vieron tus anuncios.",
  Costo: "Lo invertido en tus campañas de Google Ads.",
  Conversiones: "Acciones valiosas que hicieron las personas que llegaron por tus anuncios.",
  "Sesiones pagas": "Visitas que llegaron a tu sitio desde tus anuncios.",
};

/** Convierte el valor ya formateado ("2,5%", "0,14 USD", "1.234") al mismo formato pero con otro número. */
export function comoValor(valor: string, n: number): string {
  const m = valor.match(/^(\D*?)(-?[\d.]+(?:,\d+)?)(.*)$/);
  if (!m) return fmtNum(n);
  const dec = m[2].includes(",") ? m[2].split(",")[1].length : 0;
  return `${m[1]}${fmtNum(n, dec)}${m[3]}`;
}

function textoDelta(d: Delta): string {
  const flecha = d.tendencia === "up" ? "▲" : d.tendencia === "down" ? "▼" : "=";
  if (d.pct === null) return `${flecha} nuevo`;
  const redondeado = Math.round(d.pct * 10) / 10;
  return `${flecha} ${fmtDeltaPct(redondeado).replace("%", " %").replace(".", ",")}`;
}

function coloresDelta(d: Delta): { fg: string; bg: string } {
  if (d.tendencia === "flat") return { fg: COLOR.suave, bg: COLOR.neutroFondo };
  return d.favorable ? { fg: COLOR.bueno, bg: COLOR.buenoFondo } : { fg: COLOR.malo, bg: COLOR.maloFondo };
}

function pildora(d: Delta | null, sufijo = " vs. período anterior"): string {
  if (!d) return "";
  const { fg, bg } = coloresDelta(d);
  return `<span style="display:inline-block;align-self:flex-start;background:${bg};color:${fg};font-size:20px;font-weight:800;padding:8px 18px;border-radius:999px;white-space:nowrap;">${esc(textoDelta(d))}${esc(sufijo)}</span>`;
}

function celdaDelta(d: Delta | null): string {
  if (!d) return "—";
  return `<span style="color:${coloresDelta(d).fg};font-weight:800;">${esc(textoDelta(d))}</span>`;
}

function barraAntesAhora(etiqueta: string, ancho: number, texto: string, ahora: boolean): string {
  const estilo = ahora ? `background:${COLOR.tinta};border:2px solid ${COLOR.tinta};` : `background:${COLOR.arena};border:2px solid ${COLOR.arenaBorde};`;
  return `<div style="display:flex;align-items:center;gap:14px;margin:6px 0;"><span style="width:82px;font-size:21px;color:${COLOR.suave};">${etiqueta}</span><span style="flex:1;"><span style="display:block;height:30px;width:${Math.max(ancho, 4).toFixed(1)}%;border-radius:8px;${estilo}"></span></span><span style="font-size:24px;font-weight:${ahora ? 800 : 600};min-width:120px;text-align:right;color:${COLOR.tinta};">${esc(texto)}</span></div>`;
}

function tarjetaKpi(k: KpiResultado, esAds: boolean): string {
  const tieneNums = k.actualNum !== undefined && k.anteriorNum !== undefined;
  let barras = "";
  if (tieneNums) {
    const max = Math.max(Math.abs(k.actualNum!), Math.abs(k.anteriorNum!), 1e-9);
    barras = `<div style="margin-top:6px;">${barraAntesAhora("Antes", (Math.abs(k.anteriorNum!) / max) * 100, comoValor(k.valor, k.anteriorNum!), false)}${barraAntesAhora("Ahora", (Math.abs(k.actualNum!) / max) * 100, k.valor, true)}</div>`;
  }
  const clave = k.etiqueta === "CTR" && esAds ? "CTR_ADS" : k.etiqueta;
  const nota = NOTAS_KPI[clave];
  return `<div class="v2-card" style="display:flex;flex-direction:column;gap:12px;min-height:0;"><div style="font-size:66px;line-height:1;font-weight:800;letter-spacing:-0.03em;">${esc(k.valor)}</div><div style="font-size:24px;font-weight:700;">${esc(k.etiqueta)}</div>${pildora(k.delta)}${barras}${nota ? `<div class="v2-nota" style="border-top:2px solid #ece8de;padding-top:14px;margin-top:4px;"><b>Qué significa para ti:</b> ${esc(nota)}</div>` : ""}</div>`;
}

function filaKpiTabla(k: KpiResultado): string {
  const antes = k.anteriorNum !== undefined ? comoValor(k.valor, k.anteriorNum) : "—";
  return `<tr><td>${esc(k.etiqueta)}</td><td>${esc(antes)}</td><td class="fuerte">${esc(k.valor)}</td><td>${celdaDelta(k.delta)}</td></tr>`;
}

function tablaKpis(kpis: KpiResultado[]): string {
  return `<table class="v2-tabla"><thead><tr><th></th><th>Período anterior</th><th>Este período</th><th>Cambio</th></tr></thead><tbody>${kpis.map(filaKpiTabla).join("")}</tbody></table>`;
}

function titulo(t: string, sub?: string): string {
  return `<h1 class="v2-t">${esc(t)}</h1>${sub ? `<p class="v2-s">${esc(sub)}</p>` : ""}`;
}

function verbo(d: Delta | null): string {
  if (!d || d.tendencia === "flat") return "se mantuvieron";
  return d.tendencia === "up" ? "subieron" : "bajaron";
}

function pctAbs(d: Delta | null): string {
  if (!d || d.pct === null || d.tendencia === "flat") return "";
  return ` ${Math.abs(d.pct).toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`;
}

const buscar = (kpis: KpiResultado[], ...etiquetas: string[]) => kpis.find((k) => etiquetas.includes(k.etiqueta));

/* ───────────────────────── slides ───────────────────────── */

function tituloServicio(tipo: ReportTipo): string {
  if (tipo === "seo_aeo_geo") return "SEO · AEO · GEO";
  if (tipo === "meta_ads") return "Meta Ads";
  if (tipo === "google_ads") return "Google Ads";
  return "Meta Ads + Google Ads";
}

function seccionesDisponibles(c: InformeV2Contenido) {
  const seo = c.datos.seo?.disponible ? c.datos.seo : null;
  const aeo = c.datos.aeo?.disponible ? c.datos.aeo : null;
  const meta = c.datos.meta?.disponible ? c.datos.meta : null;
  const googleAds = c.datos.googleAds?.disponible ? c.datos.googleAds : null;
  return { seo, aeo, meta, googleAds };
}

/** KPIs que encabezan el informe (portada y resumen): los 4 más representativos de lo que se contrató. */
function kpisClave(c: InformeV2Contenido): { kpis: KpiResultado[]; esAds: boolean } {
  const { seo, meta, googleAds } = seccionesDisponibles(c);
  if (seo) {
    const orden = ["Clics", "Impresiones", "Conversiones orgánicas", "Posición media", "CTR"];
    const ks = orden.map((e) => buscar(seo.kpis, e)).filter((k): k is KpiResultado => !!k);
    return { kpis: ks.slice(0, 4), esAds: false };
  }
  if (meta && googleAds) {
    const ks = [buscar(meta.kpis, "Resultados"), buscar(meta.kpis, "Costo por resultado"), buscar(googleAds.kpis, "Conversiones"), buscar(googleAds.kpis, "Costo por conversión")].filter((k): k is KpiResultado => !!k);
    return { kpis: ks, esAds: true };
  }
  const unico = meta ?? googleAds;
  return { kpis: (unico?.kpis ?? []).slice(0, 4), esAds: true };
}

function circulos(): string {
  return `<svg width="360" height="360" viewBox="0 0 420 420" style="position:absolute;right:0;top:-30px;"><g fill="none" stroke="#e1ddd2" stroke-width="2"><circle cx="210" cy="210" r="200"/><circle cx="210" cy="210" r="150"/><circle cx="210" cy="210" r="100"/><circle cx="210" cy="210" r="50"/></g><circle cx="210" cy="210" r="9" fill="${COLOR.doradoClaro}"/></svg>`;
}

function slidePortada(ctx: ContextoV2): SlideDef {
  const c = ctx.contenido;
  const { kpis } = kpisClave(c);
  const mejores = [...kpis].sort((a, b) => Number(b.delta?.favorable && b.delta.tendencia !== "flat") - Number(a.delta?.favorable && a.delta.tendencia !== "flat")).slice(0, 3);
  const tarjetas = mejores
    .map((k) => `<div class="v2-card" style="padding:16px 26px;"><div style="font-size:50px;font-weight:800;letter-spacing:-0.03em;line-height:1;">${esc(k.valor)}</div><div style="font-size:21px;font-weight:700;margin-top:6px;">${esc(k.etiqueta)}</div></div>`)
    .join("");
  const cubre =
    ctx.tipo === "seo_aeo_geo"
      ? "SEO (que Google te muestre), AEO (que tus páginas respondan directo) y GEO (que las IA te nombren)."
      : ctx.tipo === "meta_ads"
        ? "Tus campañas en Facebook e Instagram: inversión, resultados y qué campañas rinden mejor."
        : ctx.tipo === "google_ads"
          ? "Tus campañas en Google Ads: inversión, conversiones y qué campañas rinden mejor."
          : "Tus campañas en Meta (Facebook e Instagram) y en Google Ads, para comparar qué rinde mejor.";
  const servicio = tituloServicio(ctx.tipo);
  const tamanoServicio = servicio.length > 16 ? 76 : 104;
  const lateral = tarjetas
    ? `<div style="position:absolute;right:0;top:360px;width:640px;"><div class="v2-lbl" style="font-size:20px;margin-bottom:14px;">Lo mejor del mes</div><div style="display:grid;gap:14px;">${tarjetas}</div></div>`
    : "";
  const html = `<div style="position:relative;height:100%;">${circulos()}
    <div style="position:absolute;left:0;top:30px;width:980px;">
      <div class="v2-lbl" style="font-size:24px;">${esc(ctx.mesAnioLabel.toUpperCase().replace(/ (\d{4})$/, " DE $1"))}</div>
      <h1 style="font-size:104px;line-height:1.0;font-weight:800;letter-spacing:-0.04em;margin:22px 0 26px;">Informe mensual<br><span style="font-size:${tamanoServicio}px;">${esc(servicio)}</span></h1>
      <div style="font-size:50px;font-weight:800;letter-spacing:-0.02em;">${esc(ctx.clienteNombre)}</div>
      <div class="v2-card" style="margin-top:36px;max-width:880px;"><div class="v2-lbl" style="font-size:18px;">Período del informe</div><div style="font-size:36px;font-weight:800;margin:8px 0 6px;">${esc(rangoLargo(c.periodo.desde, c.periodo.hasta))}</div><div style="font-size:22px;color:#4a463d;">Comparado con el período anterior: ${esc(rangoLargo(c.periodo.anteriorDesde, c.periodo.anteriorHasta))}</div></div>
      <p class="v2-nota" style="margin-top:24px;max-width:880px;font-size:24px;"><b style="color:${COLOR.tinta};">Qué cubre este informe:</b> ${esc(cubre)}</p>
      <p class="v2-nota" style="margin-top:18px;font-size:22px;line-height:1.6;">Emitido el <b style="color:${COLOR.tinta};">${esc(fechaLarga(c.periodo.emitidoEn))}</b><br>Preparado por el equipo de marketing de Bigbuda</p>
    </div>
    ${lateral}
  </div>`;
  return { seccion: "", html, portada: true };
}

function slideResumen(ctx: ContextoV2): SlideDef | null {
  const c = ctx.contenido;
  const { kpis, esAds } = kpisClave(c);
  if (kpis.length === 0) return null;
  const { seo, meta, googleAds } = seccionesDisponibles(c);
  let titular = "Así le fue a tu marketing este período.";
  let sub = "";
  if (seo) {
    const clics = buscar(seo.kpis, "Clics");
    if (clics) titular = `Tus clics desde Google ${verbo(clics.delta)}${pctAbs(clics.delta)}.`.replace(" .", ".");
    sub = seo.insight ?? "";
  } else {
    const conv = buscar(meta?.kpis ?? googleAds?.kpis ?? [], "Conversiones", "Resultados");
    if (conv) titular = `Tus ${conv.etiqueta.toLowerCase()} ${verbo(conv.delta)}${pctAbs(conv.delta)}.`.replace(" .", ".");
    sub = (meta ?? googleAds)?.insight ?? "";
  }
  const html = `${titulo(titular, sub)}<div style="display:grid;grid-template-columns:repeat(${Math.min(kpis.length, 4)},1fr);gap:26px;">${kpis.map((k) => tarjetaKpi(k, esAds)).join("")}</div>`;
  return { seccion: "Resumen en 30 segundos", html };
}

function graficoClicsConversiones(serie: { fecha: string; valor: number }[], serieConv: { fecha: string; valor: number }[] | undefined, nombreClics: string, ancho: number, alto: number): string {
  const series = [{ nombre: nombreClics, color: COLOR.tinta, valores: serie.map((p) => p.valor), area: true }];
  if (serieConv && serieConv.length > 0) series.push({ nombre: "Conversiones", color: COLOR.bueno, valores: serieConv.map((p) => p.valor), area: false });
  const leyenda = leyendaLineas(series.map((s, i) => ({ ...s, punteada: i === 1 })));
  const lineas = series.map((s, i) => ({ ...s, punteada: i === 1 }));
  return `${leyenda}<div style="margin-top:8px;">${svgLineas({ ancho, alto, etiquetas: serie.map((p) => p.fecha), series: lineas })}</div>`;
}

function slideSeoCrecimiento(c: InformeV2Contenido, seo: SeccionSeo): SlideDef {
  const clics = buscar(seo.kpis, "Clics");
  const pos = buscar(seo.kpis, "Posición media");
  const t = clics && pos ? `Tus clics ${verbo(clics.delta)}${pctAbs(clics.delta)} y tu posición media es ${pos.valor}.`.replace("  ", " ") : "Cómo crece tu presencia en Google.";
  const f = seo.funnel;
  const embudo = f
    ? `<div class="v2-card" style="margin-top:22px;padding:20px 28px;"><div class="v2-lbl" style="font-size:17px;margin-bottom:10px;">Del buscador a la conversión</div><div style="display:flex;align-items:center;gap:18px;font-size:22px;"><div><div style="font-size:40px;font-weight:800;">${fmtNum(f.impresiones)}</div>apariciones</div><span style="color:${COLOR.suave};font-size:20px;">→ ${fmtPct(f.pctImpresionesAClics)} →</span><div><div style="font-size:40px;font-weight:800;">${fmtNum(f.clics)}</div>clics</div><span style="color:${COLOR.suave};font-size:20px;">→ ${fmtPct(f.pctClicsAConversiones)} →</span><div><div style="font-size:40px;font-weight:800;">${fmtNum(f.conversiones)}</div>conversiones</div></div></div>`
    : "";
  const html = `${titulo(t, `Cada punto es un día, del ${fechaCorta(c.periodo.desde)} al ${fechaCorta(c.periodo.hasta)}. Se compara con el período anterior.`)}
  <div style="display:grid;grid-template-columns:830px 1fr;gap:26px;align-items:start;">
    <div class="v2-card">${tablaKpis(seo.kpis)}<div class="v2-nota" style="margin-top:18px;"><b>Qué significa para ti:</b> más personas encuentran tu sitio cuando buscan lo que vendes. Posición media: el puesto en que apareces; mientras más bajo el número, más arriba.</div></div>
    <div><div class="v2-card"><div style="font-size:26px;font-weight:800;margin-bottom:12px;">Clics${seo.serieConversiones.length ? " y conversiones" : ""} por día</div>${graficoClicsConversiones(seo.serie, seo.serieConversiones, "Clics desde Google", 790, 250)}</div>${embudo}</div>
  </div>`;
  return { seccion: "Google · crecimiento", html };
}

function slideSeoRanking(seo: SeccionSeo): SlideDef | null {
  const d = seo.distribucionPosiciones;
  if (!d && seo.keywords.length === 0) return null;
  // Los baldes de `distribucionPosiciones` son exclusivos: top3 = puestos 1–3, top10 = 4–10, top20 = 11–20, top50 = 21–50.
  const max = d ? Math.max(d.top3, d.top10, d.top20, d.top50, d.mas50, 1) : 1;
  const enTop10 = d ? d.top3 + d.top10 : 0;
  const barras = d
    ? [
        barraHorizontal("Top 3", d.top3, max, "#2f6b45", fmtNum(d.top3)),
        barraHorizontal("Puestos 4–10", d.top10, max, "#2a78d6", fmtNum(d.top10)),
        barraHorizontal("Puestos 11–20", d.top20, max, "#eda100", fmtNum(d.top20)),
        barraHorizontal("Puestos 21–50", d.top50, max, "#eb6834", fmtNum(d.top50)),
        barraHorizontal("Más allá de 50", d.mas50, max, "#9ca3af", fmtNum(d.mas50)),
      ].join("")
    : "";
  const filas = seo.keywords
    .slice(0, 8)
    .map((k) => {
      const delta = k.deltaPosicion === null ? `<span style="color:${COLOR.suave};">nueva</span>` : Math.abs(k.deltaPosicion) < 0.5 ? `<span style="color:${COLOR.suave};">·</span>` : `<span style="color:${k.deltaPosicion > 0 ? COLOR.bueno : COLOR.malo};font-weight:800;">${k.deltaPosicion > 0 ? "▲" : "▼"} ${Math.abs(k.deltaPosicion).toLocaleString("es-CL")}</span>`;
      return `<tr><td>${esc(k.termino)}</td><td class="fuerte">${fmtNum(k.clics)}</td><td>${fmtNum(k.impresiones)}</td><td>${fmtNum(k.posicion, 1)}</td><td>${delta}</td></tr>`;
    })
    .join("");
  const t = d ? `${fmtNum(enTop10)} consultas tuyas están en el top 10 de Google.` : "Las búsquedas que más te traen clics.";
  const html = `${titulo(t, "El top 10 son las diez primeras posiciones de Google: la primera página. Medimos las búsquedas con más clics del período.")}
  <div style="display:grid;grid-template-columns:${d ? "760px 1fr" : "1fr"};gap:26px;align-items:start;">
    ${d ? `<div class="v2-card"><div style="font-size:26px;font-weight:800;margin-bottom:10px;">Dónde aparecen tus ${fmtNum(d.total)} consultas</div>${barras}<div class="v2-nota" style="margin-top:16px;">Cantidad de búsquedas según el puesto en que apareces en Google.</div></div>` : ""}
    <div class="v2-card"><div style="font-size:26px;font-weight:800;margin-bottom:14px;">Búsquedas que más clics traen</div><table class="v2-tabla"><thead><tr><th>Búsqueda</th><th>Clics</th><th>Apariciones</th><th>Puesto</th><th>Cambio</th></tr></thead><tbody>${filas}</tbody></table></div>
  </div>`;
  return { seccion: "Google · ranking", html };
}

function slideAeo(aeo: SeccionAeo): SlideDef {
  const fuentes = aeo.tendenciaSemanal;
  const etiquetas = fuentes[0]?.puntos.map((p) => p.etiqueta) ?? [];
  const series = fuentes.map((f) => ({ nombre: f.fuente.replace(/\.(com|ai)$/, ""), color: colorFuenteIA(f.fuente), valores: f.puntos.map((p) => p.valor), area: false }));
  const grafico = series.length
    ? `${leyendaLineas(series)}<div style="margin-top:8px;">${svgLineas({ ancho: 1040, alto: 330, etiquetas, series, tipoEtiqueta: "texto" })}</div>`
    : `<div class="v2-nota">Sin visitas desde asistentes de IA en el período.</div>`;
  const paginas = aeo.paginasDestino
    .slice(0, 5)
    .map((p) => `<tr><td style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.pagina)}</td><td>${fmtNum(p.sesiones)}</td><td class="fuerte">${fmtNum(p.conversiones)}</td></tr>`)
    .join("");
  const t = aeo.totalSesiones > 0 ? `${fmtNum(aeo.totalSesiones)} visitas llegaron desde asistentes de IA.` : "Las IA todavía te mandan pocas visitas.";
  const html = `${titulo(t, "Visitas medidas con Google Analytics que vienen de ChatGPT, Perplexity, Gemini y otros asistentes, semana a semana.")}
  <div style="display:grid;grid-template-columns:1120px 1fr;gap:26px;align-items:start;">
    <div class="v2-card"><div style="font-size:26px;font-weight:800;margin-bottom:12px;">Visitas desde IA, semana a semana</div>${grafico}</div>
    <div style="display:grid;gap:22px;">
      <div class="v2-card" style="display:flex;flex-direction:column;gap:10px;"><div style="font-size:60px;font-weight:800;letter-spacing:-0.03em;line-height:1;">${fmtNum(aeo.totalSesiones)}</div><div style="font-size:23px;font-weight:700;">visitas desde IA</div>${pildora(aeo.deltaSesiones)}${aeo.tasaConversion !== null ? `<div class="v2-nota" style="margin-top:6px;"><b>Tasa de conversión:</b> ${fmtPct(aeo.tasaConversion)}</div>` : ""}</div>
      ${paginas ? `<div class="v2-card"><div style="font-size:23px;font-weight:800;margin-bottom:12px;">Páginas a las que llegan</div><table class="v2-tabla" style="font-size:19px;"><thead><tr><th>Página</th><th>Visitas</th><th>Conv.</th></tr></thead><tbody>${paginas}</tbody></table></div>` : ""}
    </div>
  </div>
  <p class="v2-nota" style="margin-top:20px;">El tráfico desde IA se subestima: varias plataformas no envían el origen de la visita y caen como “directo”, y los resúmenes de IA de Google no se pueden filtrar.</p>`;
  return { seccion: "Respuestas de IA", html };
}

function slideAds(nombre: "Meta Ads" | "Google Ads", s: SeccionMeta | SeccionGoogleAds, c: InformeV2Contenido): SlideDef {
  const res = buscar(s.kpis, "Resultados", "Conversiones");
  const costo = buscar(s.kpis, "Costo por resultado", "Costo por conversión");
  const t = res && costo ? `${nombre}: ${res.valor} ${res.etiqueta.toLowerCase()} a ${costo.valor} cada uno.` : `${nombre}: cómo les fue a tus campañas.`;
  const nombreClics = nombre === "Google Ads" && (s as SeccionGoogleAds).fuente === "ga4" ? "Sesiones" : "Clics";
  const conv = (s as SeccionMeta).serieConversiones;
  const html = `${titulo(t, `Cada punto es un día, del ${fechaCorta(c.periodo.desde)} al ${fechaCorta(c.periodo.hasta)}. Se compara con el período anterior.`)}
  <div style="display:grid;grid-template-columns:830px 1fr;gap:26px;align-items:start;">
    <div class="v2-card">${tablaKpis(s.kpis)}</div>
    <div class="v2-card"><div style="font-size:26px;font-weight:800;margin-bottom:12px;">${nombreClics}${conv && conv.length ? " y conversiones" : ""} por día</div>${graficoClicsConversiones(s.serie, conv, nombreClics, 790, 360)}</div>
  </div>`;
  return { seccion: nombre, html };
}

function slideCampanas(nombre: "Meta Ads" | "Google Ads", campanas: FilaCampana[], moneda: string, etiquetaInteracciones: string): SlideDef | null {
  if (campanas.length === 0) return null;
  const filas = campanas
    .slice(0, 8)
    .map((f) => `<tr><td style="max-width:640px;">${esc(f.nombre)}</td><td>${fmtNum(f.interacciones)}</td><td class="fuerte">${fmtNum(f.conversiones)}</td><td>${fmtPct(f.tasaConversion)}</td><td>${f.costoPorConversion !== null ? esc(fmtMoneda(f.costoPorConversion)) : "—"}</td></tr>`)
    .join("");
  const mejor = [...campanas].filter((f) => f.conversiones > 0 && f.costoPorConversion !== null).sort((a, b) => a.costoPorConversion! - b.costoPorConversion!)[0];
  const t = mejor ? `La campaña que más rinde: ${mejor.nombre}.` : "Qué campañas están rindiendo.";
  const html = `${titulo(t, "Conversiones y costo por conversión de cada campaña en el período.")}<div class="v2-card"><table class="v2-tabla"><thead><tr><th>Campaña</th><th>${esc(etiquetaInteracciones)}</th><th>Conversiones</th><th>Tasa conv.</th><th>Costo / conv.</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  return { seccion: `${nombre} · campañas`, html };
}

function slideInsights(etiqueta: string, frases: string[]): SlideDef | null {
  const lista = frases.map((f) => f.trim()).filter(Boolean);
  if (lista.length === 0) return null;
  const tarjetas = lista
    .map(
      (f, i) =>
        `<div class="v2-card" style="display:flex;gap:26px;align-items:flex-start;padding:34px 38px;"><span style="flex:none;width:58px;height:58px;border-radius:50%;background:${COLOR.tinta};color:#fff;font-size:28px;font-weight:800;display:flex;align-items:center;justify-content:center;">${i + 1}</span><span style="font-size:36px;line-height:1.35;font-weight:600;letter-spacing:-0.01em;">${esc(f)}</span></div>`,
    )
    .join("");
  return { seccion: `Insights · ${etiqueta}`, html: `${titulo(`Lo que vemos en ${etiqueta}.`, "Lo más importante del período, en tres ideas.")}<div style="display:grid;gap:22px;max-width:1500px;">${tarjetas}</div>` };
}

function slideHechos(hechos: string[]): SlideDef | null {
  const lista = hechos.map((h) => h.trim()).filter(Boolean);
  if (lista.length === 0) return null;
  const items = lista
    .slice(0, 8)
    .map((h) => `<div style="display:flex;gap:22px;align-items:flex-start;padding:18px 0;border-bottom:2px solid #f0ece3;"><span style="flex:none;width:18px;height:18px;margin-top:12px;border-radius:50%;border:4px solid ${COLOR.tinta};"></span><span style="font-size:28px;line-height:1.4;">${esc(h)}</span></div>`)
    .join("");
  return { seccion: "Lo que hicimos", html: `${titulo("Lo que hicimos este período.", "Los cambios y ajustes que trabajamos para mejorar tus resultados.")}<div class="v2-card" style="max-width:1500px;padding-top:12px;padding-bottom:12px;">${items}</div>` };
}

function slideProximos(proximos: string[]): SlideDef | null {
  const lista = proximos.map((p) => p.trim()).filter(Boolean);
  if (lista.length === 0) return null;
  const items = lista
    .slice(0, 5)
    .map((p, i) => `<div style="display:flex;gap:26px;align-items:flex-start;padding:22px 0;border-bottom:2px solid rgba(255,255,255,0.12);"><span style="flex:none;width:52px;height:52px;border-radius:50%;background:${COLOR.doradoClaro};color:#18181b;font-size:26px;font-weight:800;display:flex;align-items:center;justify-content:center;">${i + 1}</span><span style="font-size:32px;line-height:1.4;font-weight:600;color:#f6f2ea;">${esc(p)}</span></div>`)
    .join("");
  return {
    seccion: "Lo que viene",
    html: `${titulo("Lo que viene: qué hacemos, en este orden.", "Los próximos pasos para seguir mejorando.")}<div style="background:#18181b;border-radius:26px;padding:20px 48px;max-width:1500px;">${items}</div>`,
  };
}

function slideMetodologia(ctx: ContextoV2): SlideDef {
  const c = ctx.contenido;
  const { seo, aeo, meta, googleAds } = seccionesDisponibles(c);
  const fila = (k: string, v: string) => `<div style="display:grid;grid-template-columns:260px 1fr;gap:24px;padding:16px 0;border-bottom:2px solid #ece8de;"><div style="font-size:22px;font-weight:800;color:${COLOR.dorado};">${esc(k)}</div><div style="font-size:23px;line-height:1.45;color:#2f2c26;">${v}</div></div>`;
  const filas: string[] = [];
  filas.push(fila("Período", `<b>Período actual:</b> ${esc(rangoLargo(c.periodo.desde, c.periodo.hasta))} (${diasEntreIso(c.periodo.desde, c.periodo.hasta)} días). <b>Período anterior:</b> ${esc(rangoLargo(c.periodo.anteriorDesde, c.periodo.anteriorHasta))}, medidos con el mismo método.`));
  if (seo) filas.push(fila("Google Search Console", `Clics, apariciones, CTR y posición media de tu sitio. Google entrega estos datos con 3 días de retraso${seo.gscHasta ? `: el último día medido es el ${esc(fechaLarga(seo.gscHasta))}` : ""}. Posición media: puesto promedio en los resultados; mientras más bajo el número, más arriba apareces.`));
  if (aeo || seo) filas.push(fila("Google Analytics", "Visitas y conversiones del sitio. Las visitas desde asistentes de IA son un mínimo medido: Google Analytics no siempre identifica ese origen."));
  if (meta) filas.push(fila("Meta Ads", `Inversión, resultados y campañas de Facebook e Instagram, en ${esc(meta.moneda)}. En campañas que llevan al sitio, la conversión es la medida en Google Analytics; en campañas de mensajes, las conversaciones iniciadas.`));
  if (googleAds) filas.push(fila("Google Ads", googleAds.fuente === "ga4" ? "Cifras aproximadas medidas con Google Analytics (visitas pagas de Google). Para el número oficial de la cuenta, revisa Google Ads directo." : "Cifras oficiales de tu cuenta de Google Ads: costo, clics, conversiones y campañas activas."));
  filas.push(fila("Cómo leerlo", "Las flechas verdes son buenas noticias y las rojas, alertas: en costos y en posición media, bajar es mejorar. “Antes” es el período anterior de igual largo."));
  return { seccion: "Anexo · Metodología", html: `<h1 class="v2-t" style="margin-bottom:18px;">Cómo medimos.</h1>${filas.join("")}` };
}

function slideCierre(c: InformeV2Contenido, proximos: string[]): SlideDef {
  const lista = proximos.map((p) => p.trim()).filter(Boolean).slice(0, 5);
  const url = c.agendaUrl.trim();
  const html = `${titulo("Agenda tu reunión de marketing.", "Revisamos este informe juntos, en 30 minutos, con el equipo de marketing de Bigbuda y dejamos por escrito los próximos pasos del mes.")}
  <div style="background:#18181b;border-radius:26px;padding:44px 52px;max-width:1100px;"><div style="display:inline-block;background:${COLOR.doradoClaro};color:#18181b;font-size:30px;font-weight:800;padding:20px 38px;border-radius:14px;">Agendar reunión de marketing · 30 minutos</div>${url ? `<div style="font-size:26px;color:#cfc9bb;margin-top:22px;">${esc(url)}</div>` : ""}</div>
  ${lista.length ? `<div class="v2-card" style="margin-top:26px;max-width:1100px;"><div style="font-size:26px;font-weight:800;margin-bottom:10px;">Podemos ver en la reunión</div><ul style="margin:0;padding-left:30px;font-size:25px;line-height:1.6;">${lista.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}`;
  return { seccion: "Siguiente paso", html };
}

/* ───────────────────────── ensamblado ───────────────────────── */

function armarSlides(ctx: ContextoV2): SlideDef[] {
  const c = ctx.contenido;
  const { seo, aeo, meta, googleAds } = seccionesDisponibles(c);
  const slides: (SlideDef | null)[] = [slidePortada(ctx), slideResumen(ctx)];

  if (seo) {
    slides.push(slideSeoCrecimiento(c, seo), slideSeoRanking(seo));
    if (aeo) slides.push(slideAeo(aeo));
    slides.push(slideInsights("SEO · AEO · GEO", c.insights.seo));
  }
  if (meta) {
    slides.push(slideAds("Meta Ads", meta, c), slideCampanas("Meta Ads", meta.campanas, meta.moneda, "Clics"), slideInsights("Meta Ads", c.insights.meta));
  }
  if (googleAds) {
    const ga4 = googleAds.fuente === "ga4";
    slides.push(slideAds("Google Ads", googleAds, c), slideCampanas("Google Ads", googleAds.campanas, googleAds.moneda ?? "CLP", ga4 ? "Sesiones" : "Clics"), slideInsights("Google Ads", c.insights.googleAds));
  }
  slides.push(slideHechos(c.hechos), slideProximos(c.proximos), slideMetodologia(ctx), slideCierre(c, c.proximos));
  return slides.filter((s): s is SlideDef => !!s);
}

/** Slides HTML del informe v2, con encabezado, pie y numeración de páginas. */
export function renderSlidesV2(ctx: ContextoV2): string[] {
  const defs = armarSlides(ctx);
  const total = defs.length;
  return defs.map((d, i) => {
    const cabecera = `<div class="v2-head"><img src="${ctx.logoSrc}" alt="bigbuda">${d.seccion ? `<span>${esc(d.seccion)}</span>` : ""}</div>`;
    const pie = `<div class="v2-foot"><span>Informe de ${esc(ctx.mesAnioLabel.toLowerCase())} · ${esc(ctx.clienteNombre)}</span><span><b>Página ${i + 1} de ${total}</b></span></div>`;
    return `<section class="v2-slide">${cabecera}<div class="v2-body">${d.html}</div>${pie}</section>`;
  });
}

/** Etiquetas de las secciones con datos faltantes — el editor las muestra como aviso. */
export function seccionesSinDatos(c: InformeV2Contenido, tipo: ReportTipo): string[] {
  const faltan: string[] = [];
  const esperadas: { clave: keyof InformeV2Contenido["datos"]; etiqueta: string }[] =
    tipo === "seo_aeo_geo"
      ? [
          { clave: "seo", etiqueta: "Search Console (SEO)" },
          { clave: "aeo", etiqueta: "Visitas desde IA (GA4)" },
        ]
      : tipo === "meta_ads"
        ? [{ clave: "meta", etiqueta: "Meta Ads" }]
        : tipo === "google_ads"
          ? [{ clave: "googleAds", etiqueta: "Google Ads" }]
          : [
              { clave: "meta", etiqueta: "Meta Ads" },
              { clave: "googleAds", etiqueta: "Google Ads" },
            ];
  for (const e of esperadas) {
    const s = c.datos[e.clave] as { disponible: boolean; motivo?: string } | undefined;
    if (!s?.disponible) faltan.push(`${e.etiqueta}: ${s?.motivo ?? "sin datos"}`);
    else if ((s as { deCache?: string | null }).deCache) faltan.push(`${e.etiqueta}: ${(s as { deCache?: string | null }).deCache} Las cifras pueden estar desactualizadas.`);
  }
  return faltan;
}
