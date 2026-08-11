import { boldAccent, esc, etiquetaSeccion, barraAcento, piePagina } from "@/lib/informes/render";
import type { InformeMarketingContenido } from "@/lib/informes/tipos";

export type ServicioAdsTipo = "meta_ads" | "google_ads";

export interface ContextoInformeMarketing {
  clienteNombre: string;
  clienteEmpresa: string;
  contactoNombre: string;
  sitioWeb: string | null;
  mesAnioLabel: string;
  fechaSnapshotLabel: string;
  logoSrc: string;
  servicioTipo: ServicioAdsTipo;
  contenido: InformeMarketingContenido;
}

const F = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const SERVICIO_LABEL: Record<ServicioAdsTipo, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

const ESTADO_PACING_LABEL: Record<InformeMarketingContenido["inversionDelMes"]["estado"], string> = {
  dentro_rango: "Dentro de rango",
  sobregasto: "Sobre presupuesto",
  subgasto: "Bajo presupuesto",
};

/** Extrae el primer número de un texto libre ("99,2%" → 99.2) — los campos de cifras son texto libre (ver lib/informes/tipos.ts), esto solo se usa para dimensionar la barra de pacing. */
function parsePct(valor: string): number {
  const n = Number(valor.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function slidePortada(ctx: ContextoInformeMarketing) {
  const chips = ctx.contenido.portada.chips
    .map(
      (c, i) =>
        `<span style="padding:12px 24px;border:1px solid ${i === 0 ? "rgba(232,176,110,0.35)" : "var(--chip-line)"};border-radius:999px;font:500 19px ${F};letter-spacing:0.14em;text-transform:uppercase;color:${i === 0 ? "var(--accent)" : "var(--text-soft)"};">${esc(c)}</span>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 88px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:1020px;height:1020px;border-radius:50%;right:-360px;top:-380px;background:radial-gradient(circle,rgba(232,176,110,0.10),transparent 66%);pointer-events:none;"></div>
    <div style="position:absolute;width:640px;height:640px;border-radius:50%;left:-240px;bottom:-300px;background:radial-gradient(circle,var(--circle-soft),transparent 68%);pointer-events:none;"></div>
    <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font:500 19px/1 ${F};letter-spacing:0.34em;text-transform:uppercase;color:var(--text-dim);">Informe de campañas</div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:16px;">
          <span style="font:500 24px/1 ${F};letter-spacing:0.30em;text-transform:uppercase;color:var(--accent);">${SERVICIO_LABEL[ctx.servicioTipo]}</span>
          <span style="font-size:20px;color:var(--accent);letter-spacing:0.12em;">★★★★★</span>
        </div>
      </div>
      <div style="text-align:right;"><div style="font:500 22px/1.5 ${F};letter-spacing:0.22em;text-transform:uppercase;color:var(--text-soft);">${esc(ctx.mesAnioLabel)}</div></div>
    </div>
    <div style="position:relative;margin-top:auto;">
      <div style="font:600 17px/1 ${F};letter-spacing:0.30em;text-transform:uppercase;color:var(--text-dim);margin-bottom:18px;">Cliente</div>
      <h1 style="font:200 120px/0.9 ${F};letter-spacing:-0.035em;margin:0;color:var(--ink);">${esc(ctx.clienteNombre)}</h1>
      <p style="font:200 34px/1.4 ${F};letter-spacing:-0.01em;color:var(--text-soft);max-width:1200px;margin:34px 0 0;text-wrap:pretty;">${boldAccent(ctx.contenido.portada.bajada)}</p>
      <div style="display:flex;gap:14px;margin-top:40px;flex-wrap:wrap;">${chips}</div>
    </div>
    <div style="position:relative;margin-top:64px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid var(--line);padding-top:28px;">
      <div style="font:400 22px/1.6 ${F};color:var(--text-muted);">
        Preparado para <span style="color:var(--text);font-weight:500;">${esc(ctx.contactoNombre)}</span> · ${esc(ctx.clienteEmpresa)}<br>
        <span style="font-size:18px;color:var(--text-faint);">${esc(ctx.sitioWeb ?? "")}${ctx.sitioWeb ? " · " : ""}Documento confidencial</span>
      </div>
      <div style="text-align:right;">
        <img src="${ctx.logoSrc}" alt="bigbuda" style="height:42px;display:inline-block;">
        <div style="font:400 17px/1 ${F};letter-spacing:0.14em;color:var(--text-faint);margin-top:8px;">Santiago · Toronto</div>
      </div>
    </div>
  </section>`;
}

function slideComoVamosCifras(ctx: ContextoInformeMarketing) {
  const metricas = ctx.contenido.comoVamosCifras.metricas
    .map((m) => {
      const flecha = m.deltaDireccion === "up" ? "↑" : "↓";
      return `<div>
        <div style="font:400 22px/1 ${F};color:var(--text-dim);">${esc(m.etiqueta)}</div>
        <div style="font:500 82px/0.95 ${F};letter-spacing:-0.02em;color:var(--accent);margin-top:12px;">${esc(m.valor)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:14px;font:500 20px/1 ${F};color:var(--accent-2);"><span>${flecha} ${esc(m.deltaTexto)}</span><span style="color:var(--text-faint);font-weight:400;">vs. mes anterior</span></div>
      </div>`;
    })
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:940px;height:940px;border-radius:50%;right:-380px;top:-360px;background:radial-gradient(circle,rgba(232,176,110,0.07),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("01 · ¿Cómo vamos?")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">El mes en <b style="font-weight:700;">números</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:44px 64px;margin-top:auto;margin-bottom:auto;">${metricas}</div>
    <div style="position:absolute;right:104px;bottom:74px;font:400 13px/1 ${F};letter-spacing:0.05em;color:var(--snapshot);">Datos al ${esc(ctx.fechaSnapshotLabel)}</div>
    ${piePagina(ctx.clienteNombre, "Rendimiento", ctx.logoSrc)}
  </section>`;
}

function slideInversionDelMes(ctx: ContextoInformeMarketing) {
  const inv = ctx.contenido.inversionDelMes;
  const pctEjecutado = parsePct(inv.pctEjecutado);
  const pctMesTranscurrido = parsePct(inv.pctMesTranscurrido);

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:820px;height:820px;border-radius:50%;left:-320px;bottom:-300px;background:radial-gradient(circle,rgba(232,176,110,0.055),transparent 68%);pointer-events:none;"></div>
    ${etiquetaSeccion("01 · Inversión del mes")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Cómo invertimos&nbsp;<b style="font-weight:700;">tu presupuesto</b></h2>
    ${barraAcento()}
    <div style="display:flex;gap:130px;margin-top:auto;">
      <div>
        <div style="font:600 16px/1 ${F};letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);">Presupuesto acordado</div>
        <div style="font:400 74px/1 ${F};color:var(--text);margin-top:18px;">${esc(inv.presupuesto)}</div>
      </div>
      <div>
        <div style="font:600 16px/1 ${F};letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);">Gasto real</div>
        <div style="font:500 74px/1 ${F};color:var(--accent);margin-top:18px;">${esc(inv.gasto)}</div>
      </div>
    </div>
    <div style="margin-top:76px;margin-bottom:auto;max-width:1500px;">
      <div style="position:relative;height:34px;border-radius:999px;background:var(--track);overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:${pctEjecutado}%;border-radius:999px;background:linear-gradient(90deg,var(--bar-a),var(--accent));"></div>
      </div>
      <div style="position:relative;height:24px;">
        <div style="position:absolute;left:${pctMesTranscurrido}%;top:2px;display:flex;flex-direction:column;align-items:center;transform:translateX(-50%);">
          <div style="width:2px;height:12px;background:var(--text-dim);"></div>
          <div style="font:500 14px/1.3 ${F};color:var(--text-dim);margin-top:4px;white-space:nowrap;">día ${esc(inv.diaMes)} · ${esc(inv.pctMesTranscurrido)} del mes</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:40px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="width:12px;height:12px;border-radius:50%;background:var(--accent);"></span>
          <span style="font:500 27px/1 ${F};color:var(--text);">${esc(inv.pctEjecutado)} del presupuesto ejecutado</span>
          <span style="padding:6px 16px;border:1px solid rgba(232,176,110,0.4);border-radius:999px;font:500 15px ${F};letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-left:8px;">${ESTADO_PACING_LABEL[inv.estado]}</span>
        </div>
      </div>
      <p style="font:400 24px/1.6 ${F};color:var(--text-dim);margin:38px 0 0;max-width:1160px;text-wrap:pretty;">${esc(inv.nota)}</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Inversión", ctx.logoSrc)}
  </section>`;
}

function slideQueMejoramos(ctx: ContextoInformeMarketing) {
  const acciones = ctx.contenido.queMejoramos.acciones
    .map(
      (a, i) => `<div style="display:flex;align-items:baseline;gap:28px;padding:26px 0;${i < ctx.contenido.queMejoramos.acciones.length - 1 ? "border-bottom:1px solid var(--line);" : ""}">
        <span style="font:500 30px/1.3 ${F};color:var(--text);flex:1;">${esc(a.accion)}</span>
        <span style="color:var(--accent);font-size:26px;flex-shrink:0;">→</span>
        <span style="font:400 26px/1.3 ${F};color:var(--accent-2);flex:1;">${esc(a.efecto)}</span>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    ${etiquetaSeccion("02 · ¿Qué mejoramos?")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Lo que movimos <b style="font-weight:700;">este mes</b></h2>
    ${barraAcento()}
    <div style="display:flex;flex-direction:column;margin-top:40px;">${acciones}</div>
    ${piePagina(ctx.clienteNombre, "Mejoras", ctx.logoSrc)}
  </section>`;
}

function slideQueProyectamos(ctx: ContextoInformeMarketing) {
  return `<section class="informe-slide" style="padding:82px 104px 128px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:900px;height:900px;border-radius:50%;right:-360px;bottom:-340px;background:radial-gradient(circle,rgba(232,176,110,0.08),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("03 · ¿Qué proyectamos?")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Qué esperar en el&nbsp;<b style="font-weight:700;">próximo período</b></h2>
    ${barraAcento()}
    <p style="font:400 32px/1.55 ${F};color:var(--text-muted);margin:46px 0 0;max-width:1420px;text-wrap:pretty;">${esc(ctx.contenido.queProyectamos.queEsperar)}</p>
    <div style="margin-top:auto;background:rgba(232,176,110,0.07);border:1px solid rgba(232,176,110,0.22);border-radius:16px;padding:42px 48px;max-width:1600px;">
      <div style="font:600 16px/1 ${F};letter-spacing:0.22em;text-transform:uppercase;color:var(--accent);margin-bottom:24px;">El insight del mes</div>
      <p style="font:200 46px/1.36 ${F};letter-spacing:-0.01em;color:var(--text);margin:0;text-wrap:pretty;">${boldAccent(ctx.contenido.queProyectamos.insight)}</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Proyección", ctx.logoSrc)}
  </section>`;
}

/** Fijo — §3.4: versión compacta de garantías, casi nunca cambia entre informes. */
function slideCierre(ctx: ContextoInformeMarketing) {
  const puntos = ["Sin tocar tu operación", "Verificado en vivo", "Sin inventar nada", "Todo medido y reversible"]
    .map(
      (t) =>
        `<span style="display:flex;align-items:center;gap:12px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);"></span>${t}</span>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;justify-content:center;">
    <div style="position:absolute;width:1000px;height:1000px;border-radius:50%;left:-380px;top:-360px;background:radial-gradient(circle,rgba(232,176,110,0.06),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("Cierre")}
    <h2 style="font:200 66px/1.06 ${F};letter-spacing:-0.018em;margin:22px 0 0;color:var(--ink);max-width:1400px;">Trabajo hecho con <b style="font-weight:700;">red de seguridad</b></h2>
    <div style="width:60px;height:3px;background:var(--accent);margin-top:26px;border-radius:2px;"></div>
    <div style="display:flex;flex-wrap:wrap;gap:18px 40px;margin-top:44px;font:400 26px/1.4 ${F};color:var(--text-soft);">${puntos}</div>
    <div style="margin-top:96px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid var(--line);padding-top:34px;">
      <div style="font:500 20px/1 ${F};letter-spacing:0.24em;text-transform:uppercase;color:var(--text-dim);">${SERVICIO_LABEL[ctx.servicioTipo]} · Rendimiento</div>
      <div style="text-align:right;">
        <img src="${ctx.logoSrc}" alt="bigbuda" style="height:58px;display:inline-block;">
        <div style="font:400 17px/1 ${F};color:var(--text-faint);margin-top:10px;">${esc(ctx.clienteNombre)} · ${esc(ctx.mesAnioLabel)} · Documento confidencial</div>
      </div>
    </div>
  </section>`;
}

export function renderSlidesMarketing(ctx: ContextoInformeMarketing): string[] {
  return [
    slidePortada(ctx),
    slideComoVamosCifras(ctx),
    slideInversionDelMes(ctx),
    slideQueMejoramos(ctx),
    slideQueProyectamos(ctx),
    slideCierre(ctx),
  ];
}
