import { boldAccent, esc, etiquetaSeccion, barraAcento, piePagina } from "@/lib/informes/render";
import type { InformeSeoContenido } from "@/lib/informes/tipos";

export interface ContextoInformeSeo {
  clienteNombre: string;
  clienteEmpresa: string;
  contactoNombre: string;
  sitioWeb: string | null;
  mesAnioLabel: string;
  fechaSnapshotLabel: string;
  logoSrc: string;
  contenido: InformeSeoContenido;
}

const F = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function slidePortada(ctx: ContextoInformeSeo) {
  const chips = ctx.contenido.portada.chips
    .map(
      (c, i) =>
        `<span style="padding:12px 24px;border:1px solid ${i === ctx.contenido.portada.chips.length - 1 ? "rgba(232,176,110,0.35)" : "var(--chip-line)"};border-radius:999px;font:500 19px ${F};letter-spacing:0.14em;text-transform:uppercase;color:${i === ctx.contenido.portada.chips.length - 1 ? "var(--accent)" : "var(--text-soft)"};">${esc(c)}</span>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 88px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:1020px;height:1020px;border-radius:50%;right:-360px;top:-380px;background:radial-gradient(circle,rgba(232,176,110,0.10),transparent 66%);pointer-events:none;"></div>
    <div style="position:absolute;width:640px;height:640px;border-radius:50%;left:-240px;bottom:-300px;background:radial-gradient(circle,var(--circle-soft),transparent 68%);pointer-events:none;"></div>
    <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font:500 19px/1 ${F};letter-spacing:0.34em;text-transform:uppercase;color:var(--text-dim);">Informe de optimización</div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:16px;">
          <span style="font:500 24px/1 ${F};letter-spacing:0.30em;text-transform:uppercase;color:var(--accent);">SEO · AEO · GEO</span>
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

function slideEnUnaFrase(ctx: ContextoInformeSeo) {
  return `<section class="informe-slide" style="padding:86px 104px 108px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:860px;height:860px;border-radius:50%;left:-320px;top:-260px;background:radial-gradient(circle,rgba(232,176,110,0.055),transparent 68%);pointer-events:none;"></div>
    ${etiquetaSeccion("01 · En una frase")}
    ${barraAcento()}
    <div style="margin-top:auto;margin-bottom:auto;">
      <p style="font:200 60px/1.32 ${F};letter-spacing:-0.015em;color:var(--text);max-width:1420px;margin:0;text-wrap:pretty;">${boldAccent(ctx.contenido.enUnaFrase.principal)}</p>
      <p style="font:200 42px/1.4 ${F};letter-spacing:-0.01em;color:var(--text-muted);max-width:1300px;margin:44px 0 0;text-wrap:pretty;">${boldAccent(ctx.contenido.enUnaFrase.secundario)}</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Resumen", ctx.logoSrc)}
  </section>`;
}

function slideNuestroEnfoque(ctx: ContextoInformeSeo) {
  const decisiones = ctx.contenido.nuestroEnfoque.decisiones
    .map(
      (d) => `<div>
        <div style="font:500 29px/1.3 ${F};color:var(--text);">${esc(d.titulo)}</div>
        <div style="font:400 22px/1.5 ${F};color:var(--text-dim);margin-top:12px;text-wrap:pretty;">${esc(d.descripcion)}</div>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:86px 104px 108px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:760px;height:760px;border-radius:50%;right:-300px;bottom:-280px;background:radial-gradient(circle,rgba(232,176,110,0.05),transparent 68%);pointer-events:none;"></div>
    ${etiquetaSeccion("02 · Nuestro enfoque")}
    <h2 style="font:200 66px/1.04 ${F};letter-spacing:-0.018em;margin:44px 0 0;color:var(--ink);">Rigor primero: lo que decidimos <b style="font-weight:700;">no hacer</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:0.9fr 1.35fr;gap:72px;margin-top:auto;margin-bottom:auto;align-items:start;">
      <div style="border-left:2px solid rgba(232,176,110,0.5);padding-left:30px;">
        ${
          ctx.contenido.nuestroEnfoque.cita
            ? `<p style="font:200 34px/1.4 ${F};color:var(--text);margin:0;text-wrap:pretty;">"${esc(ctx.contenido.nuestroEnfoque.cita)}"</p>
        <p style="font:500 22px/1.4 ${F};color:var(--text-muted);margin:24px 0 0;">— ${esc(ctx.contenido.nuestroEnfoque.citaAutor)}</p>`
            : ""
        }
        <p style="font:400 24px/1.5 ${F};color:var(--text-dim);margin:36px 0 0;text-wrap:pretty;">${esc(ctx.contenido.nuestroEnfoque.contexto)}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:38px 56px;">${decisiones}</div>
    </div>
    ${piePagina(ctx.clienteNombre, "Enfoque", ctx.logoSrc)}
  </section>`;
}

function slidePuntoDePartida(ctx: ContextoInformeSeo) {
  const metricas = ctx.contenido.puntoDePartida.metricas
    .map(
      (m) => `<div>
        <div style="font:600 100px/0.9 ${F};letter-spacing:-0.03em;color:var(--accent);">${esc(m.valor)}</div>
        <div style="font:500 25px/1.2 ${F};color:var(--text);margin-top:16px;">${esc(m.etiqueta)}</div>
        <div style="font:400 22px/1.45 ${F};color:var(--text-dim);margin-top:6px;">${esc(m.descripcion)}</div>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:820px;height:820px;border-radius:50%;left:-320px;top:-300px;background:radial-gradient(circle,var(--circle-soft),transparent 68%);pointer-events:none;"></div>
    ${etiquetaSeccion("03 · Punto de partida")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">De dónde <b style="font-weight:700;">partimos</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:46px 72px;margin-top:auto;margin-bottom:auto;">${metricas}</div>
    <div style="position:absolute;right:104px;bottom:74px;font:400 13px/1 ${F};letter-spacing:0.05em;color:var(--snapshot);">Datos al ${esc(ctx.fechaSnapshotLabel)}</div>
    ${piePagina(ctx.clienteNombre, "Diagnóstico", ctx.logoSrc)}
  </section>`;
}

function slideLoQueDejamosFuncionando(ctx: ContextoInformeSeo) {
  const columnas = ctx.contenido.loQueDejamosFuncionando.columnas
    .map((col) => {
      const bullets = col.bullets
        .map(
          (b) =>
            `<li style="font:400 23px/1.4 ${F};color:var(--text-muted);padding-left:22px;position:relative;"><span style="position:absolute;left:0;top:12px;width:7px;height:7px;border-radius:50%;background:var(--accent);"></span>${esc(b)}</li>`,
        )
        .join("");
      return `<div style="border-top:1px solid rgba(232,176,110,0.4);padding-top:28px;">
        <div style="font:700 36px/1 ${F};letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);">${esc(col.titulo)}</div>
        <div style="font:400 27px/1.3 ${F};color:var(--text);margin-top:14px;">${esc(col.subtitulo)}</div>
        <ul style="list-style:none;padding:0;margin:30px 0 0;display:flex;flex-direction:column;gap:20px;">${bullets}</ul>
      </div>`;
    })
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:900px;height:900px;border-radius:50%;right:-360px;top:-340px;background:radial-gradient(circle,rgba(232,176,110,0.06),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("04 · Lo que dejamos funcionando")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Tres frentes, <b style="font-weight:700;">todo en vivo</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:56px;margin-top:auto;margin-bottom:auto;">${columnas}</div>
    ${piePagina(ctx.clienteNombre, "Entregado", ctx.logoSrc)}
  </section>`;
}

function slideDetalle(ctx: ContextoInformeSeo, titulo: string, items: { titulo: string; porque: string }[], numero: string) {
  const bloques = items
    .map(
      (it) => `<div>
        <div style="font:500 30px/1.25 ${F};color:var(--text);">${esc(it.titulo)}</div>
        <div style="margin-top:16px;display:flex;gap:16px;"><span style="font:600 15px/1.5 ${F};letter-spacing:0.2em;color:var(--accent);flex-shrink:0;padding-top:2px;">POR QUÉ</span><span style="font:400 22px/1.5 ${F};color:var(--text-dim);text-wrap:pretty;">${esc(it.porque)}</span></div>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    ${etiquetaSeccion(`${numero} · ${titulo}`)}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Qué hicimos y <b style="font-weight:700;">por qué</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px 72px;margin-top:auto;margin-bottom:auto;">${bloques}</div>
    ${piePagina(ctx.clienteNombre, "Detalle", ctx.logoSrc)}
  </section>`;
}

function slideResultadosNumeros(ctx: ContextoInformeSeo) {
  const cifras = ctx.contenido.resultadosNumeros.cifras
    .map(
      (c) => `<div>
        <div style="font:500 104px/0.9 ${F};letter-spacing:-0.02em;color:var(--accent);">${esc(c.valor)}</div>
        <div style="font:400 24px/1.4 ${F};color:var(--text-muted);margin-top:16px;max-width:380px;text-wrap:pretty;">${esc(c.descripcion)}</div>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:940px;height:940px;border-radius:50%;right:-380px;top:-360px;background:radial-gradient(circle,rgba(232,176,110,0.07),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("05 · Resultados en números")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Lo que <b style="font-weight:700;">cambió</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px 64px;margin-top:auto;margin-bottom:auto;">${cifras}</div>
    <div style="position:absolute;right:104px;bottom:74px;font:400 13px/1 ${F};letter-spacing:0.05em;color:var(--snapshot);">Datos al ${esc(ctx.fechaSnapshotLabel)}</div>
    ${piePagina(ctx.clienteNombre, "Números", ctx.logoSrc)}
  </section>`;
}

function slideTraficoIA(ctx: ContextoInformeSeo) {
  const t = ctx.contenido.traficoIA;
  if (!t) return null;
  const filas = t.filas
    .map(
      (f, i) =>
        `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:22px 8px;${i < t.filas.length - 1 ? "border-bottom:1px solid var(--line-soft);" : ""}font:400 27px/1 ${F};color:var(--text);"><span>${esc(f.fuente)}</span><span style="text-align:right;">${esc(f.sesiones)}</span><span style="text-align:right;">${esc(f.usuarios)}</span><span style="text-align:right;color:var(--accent);">${esc(f.conversiones)}</span></div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:820px;height:820px;border-radius:50%;left:-320px;top:-300px;background:radial-gradient(circle,rgba(232,176,110,0.05),transparent 68%);pointer-events:none;"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        ${etiquetaSeccion("05 · Tráfico desde inteligencia artificial")}
        <h2 style="font:200 60px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Quién te está <b style="font-weight:700;">citando</b></h2>
      </div>
      <div style="text-align:right;padding-top:6px;">
        <div style="font:500 66px/0.9 ${F};color:var(--accent);">${esc(t.totalSesiones)}</div>
        <div style="font:400 20px/1.3 ${F};color:var(--text-muted);margin-top:8px;">sesiones desde IA</div>
      </div>
    </div>
    <div style="width:60px;height:3px;background:var(--accent);margin-top:20px;border-radius:2px;"></div>
    <div style="margin-top:auto;">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:0 8px 16px;border-bottom:1px solid var(--line-strong);font:600 16px/1 ${F};letter-spacing:0.16em;text-transform:uppercase;color:var(--text-dim);">
        <span>Fuente</span><span style="text-align:right;">Sesiones</span><span style="text-align:right;">Usuarios</span><span style="text-align:right;">Conversiones</span>
      </div>
      ${filas}
    </div>
    <div style="margin-top:auto;display:flex;align-items:flex-start;gap:14px;max-width:1180px;">
      <div style="width:26px;height:1px;background:var(--accent);margin-top:16px;flex-shrink:0;"></div>
      <p style="font:400 20px/1.5 ${F};font-style:italic;color:var(--text-dim);margin:0;text-wrap:pretty;">Varias plataformas de IA no reportan su origen; estas cifras son un piso, no un total.</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Números · IA", ctx.logoSrc)}
  </section>`;
}

function slideAntesDespues(ctx: ContextoInformeSeo) {
  const a = ctx.contenido.antesDespues;
  if (!a) return null;
  const pares = a.pares
    .map(
      (p) => `<div>
        <div style="font:600 15px/1 ${F};letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);margin-bottom:16px;">${esc(p.etiqueta)}</div>
        <div style="font:400 30px/1.3 ${F};color:var(--text-faint);text-decoration:line-through;text-decoration-color:rgba(232,176,110,0.5);">${esc(p.antes)}</div>
        <div style="font:600 34px/1.3 ${F};color:var(--ink);margin-top:12px;">${esc(p.despues)}</div>
      </div>
      <div style="height:1px;background:var(--line);"></div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    ${etiquetaSeccion("05 · Antes / Después")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Títulos que ahora <b style="font-weight:700;">venden</b></h2>
    ${barraAcento()}
    <div style="display:flex;flex-direction:column;gap:38px;margin-top:auto;margin-bottom:auto;">${pares}</div>
    <div style="margin-top:auto;display:flex;align-items:flex-start;gap:14px;max-width:1280px;">
      <div style="width:26px;height:1px;background:var(--accent);margin-top:15px;flex-shrink:0;"></div>
      <p style="font:400 22px/1.5 ${F};color:var(--text-muted);margin:0;text-wrap:pretty;">${boldAccent(a.nota)}</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Números", ctx.logoSrc)}
  </section>`;
}

function slideImpactoProyectado(ctx: ContextoInformeSeo) {
  const horizontes = ctx.contenido.impactoProyectado.horizontes
    .map(
      (h) => `<div style="border-top:1px solid rgba(232,176,110,0.4);padding-top:26px;">
        <div style="font:600 18px/1 ${F};letter-spacing:0.22em;text-transform:uppercase;color:var(--accent);">${esc(h.etiqueta)}</div>
        <div style="font:400 32px/1.25 ${F};color:var(--text);margin-top:18px;">${esc(h.titulo)}</div>
        <p style="font:400 23px/1.5 ${F};color:var(--text-dim);margin:20px 0 0;text-wrap:pretty;">${esc(h.descripcion)}</p>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:860px;height:860px;border-radius:50%;right:-340px;bottom:-320px;background:radial-gradient(circle,rgba(232,176,110,0.055),transparent 68%);pointer-events:none;"></div>
    ${etiquetaSeccion("06 · Impacto proyectado")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Qué esperar — <b style="font-weight:700;">semanas y meses</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:56px;margin-top:52px;">${horizontes}</div>
    <div style="margin-top:auto;background:rgba(232,176,110,0.07);border:1px solid rgba(232,176,110,0.22);border-radius:14px;padding:30px 36px;max-width:1400px;">
      <p style="font:400 26px/1.5 ${F};color:var(--text-soft);margin:0;text-wrap:pretty;">${boldAccent(ctx.contenido.impactoProyectado.nota)}</p>
    </div>
    ${piePagina(ctx.clienteNombre, "Impacto", ctx.logoSrc)}
  </section>`;
}

function slideHojaDeRuta(ctx: ContextoInformeSeo) {
  const pasos = ctx.contenido.hojaDeRuta.pasos
    .map(
      (p, i) => `<div style="display:flex;align-items:baseline;gap:34px;padding:24px 0;${i < ctx.contenido.hojaDeRuta.pasos.length - 1 ? "border-bottom:1px solid var(--line);" : ""}">
        <span style="font:500 46px/1 ${F};color:var(--accent);width:56px;flex-shrink:0;">${i + 1}</span>
        <span style="font:500 32px/1.1 ${F};color:var(--text);width:400px;flex-shrink:0;">${esc(p.titulo)}</span>
        <span style="font:400 24px/1.4 ${F};color:var(--text-dim);text-wrap:pretty;">${esc(p.descripcion)}</span>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    ${etiquetaSeccion("07 · Hoja de ruta")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Los próximos pasos para <b style="font-weight:700;">liderar</b></h2>
    ${barraAcento()}
    <div style="display:flex;flex-direction:column;margin-top:36px;">${pasos}</div>
    ${piePagina(ctx.clienteNombre, "Roadmap", ctx.logoSrc)}
  </section>`;
}

/** Fijo — §3.4: "sección estándar del sistema, casi nunca cambia entre informes". */
function slideGarantias(ctx: ContextoInformeSeo) {
  const tarjetas = [
    ["Sin tocar tu diseño", "Ni formularios, ni galerías, ni menú, ni campañas activas."],
    ["Verificado en vivo", "Cada cambio comprobado en producción, uno por uno, el mismo día."],
    ["Sin inventar nada", "Datos reales de tu sitio, tu flota y tu negocio."],
    ["Reversible", "Todo cambio queda registrado y puede revertirse."],
  ]
    .map(
      ([t, d]) => `<div style="border:1px solid var(--line-strong);border-radius:16px;padding:34px 30px;background:var(--panel);">
        <div style="font:500 30px/1.2 ${F};color:var(--accent);">${t}</div>
        <p style="font:400 22px/1.5 ${F};color:var(--text-dim);margin:18px 0 0;text-wrap:pretty;">${d}</p>
      </div>`,
    )
    .join("");

  return `<section class="informe-slide" style="padding:82px 104px 96px;display:flex;flex-direction:column;">
    <div style="position:absolute;width:1000px;height:1000px;border-radius:50%;left:-380px;top:-360px;background:radial-gradient(circle,rgba(232,176,110,0.06),transparent 66%);pointer-events:none;"></div>
    ${etiquetaSeccion("08 · Garantías del trabajo")}
    <h2 style="font:200 62px/1.04 ${F};letter-spacing:-0.018em;margin:18px 0 0;color:var(--ink);">Hecho con <b style="font-weight:700;">red de seguridad</b></h2>
    ${barraAcento()}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:28px;margin-top:52px;">${tarjetas}</div>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid var(--line);padding-top:34px;">
      <div style="font:500 20px/1 ${F};letter-spacing:0.24em;text-transform:uppercase;color:var(--text-dim);">SEO · AEO · GEO · CRO — Chile</div>
      <div style="text-align:right;">
        <img src="${ctx.logoSrc}" alt="bigbuda" style="height:52px;display:inline-block;">
        <div style="font:400 17px/1 ${F};color:var(--text-faint);margin-top:10px;">${esc(ctx.clienteNombre)} · ${esc(ctx.mesAnioLabel)} · Documento confidencial</div>
      </div>
    </div>
  </section>`;
}

export function renderSlidesSeo(ctx: ContextoInformeSeo): string[] {
  const detalles = ctx.contenido.detalles.map((d, i) => slideDetalle(ctx, d.titulo, d.items, i === 0 ? "04" : "04+"));
  return [
    slidePortada(ctx),
    slideEnUnaFrase(ctx),
    slideNuestroEnfoque(ctx),
    slidePuntoDePartida(ctx),
    slideLoQueDejamosFuncionando(ctx),
    ...detalles,
    slideResultadosNumeros(ctx),
    slideTraficoIA(ctx),
    slideAntesDespues(ctx),
    slideImpactoProyectado(ctx),
    slideHojaDeRuta(ctx),
    slideGarantias(ctx),
  ].filter((s): s is string => s !== null);
}
