/**
 * Utilidades compartidas por los componentes de slides (§3.4). Los slides
 * se renderizan como HTML crudo (no JSX con objetos de estilo) porque son
 * una transcripción fiel de la plantilla real diseñada — decenas de
 * propiedades de estilo por elemento en 13+6 slides; convertir cada una a
 * un objeto de estilo React solo agrega superficie para errores de
 * transcripción sin ningún beneficio, ya que el contenido no es HTML
 * arbitrario de terceros, es la plantilla fija del sistema. Todo texto que
 * entra desde el editor pasa por `esc()` antes de interpolarse.
 */

export function esc(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Markup mínimo para texto narrativo con keywords destacadas — el mismo
 * tratamiento visual de "En una frase" y "El insight del mes": texto en
 * peso light, remates en `**negrita**` con acento dorado. Escapa primero,
 * así que `**` no permite inyectar HTML.
 */
export function boldAccent(valor: string | null | undefined): string {
  const escapado = esc(valor);
  return escapado.replace(/\*\*(.+?)\*\*/g, '<b style="font-weight:600;color:var(--accent);">$1</b>');
}

/** Tokens de diseño literales de la plantilla — mismos valores para tema oscuro (el único que usa la app). */
export const ESTILOS_INFORME = `
.informe-canvas{
  --bg:#0d0d0d; --bg-body:#0a0a0a;
  --ink:#faf8f4; --text:#efece5; --text-soft:#c9c4bb; --text-muted:#a8a39a; --text-dim:#8a857c; --text-faint:#6f6a62;
  --var-tag:#5f5b53; --snapshot:#413e39;
  --accent:#e8b06e; --accent-2:#c9a06a; --accent-hover:#f0c48c; --bar-a:#c88a44;
  --panel:rgba(255,255,255,0.015); --line-soft:rgba(255,255,255,0.06); --line:rgba(255,255,255,0.1); --line-strong:rgba(255,255,255,0.13); --chip-line:rgba(255,255,255,0.18); --track:rgba(255,255,255,0.07); --circle-soft:rgba(255,255,255,0.03);
}
.informe-canvas *{box-sizing:border-box;}
.informe-slide{width:1920px;height:1080px;position:relative;overflow:hidden;background:var(--bg);color:var(--text);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;flex-shrink:0;}
.informe-canvas a{color:var(--accent);text-decoration:none;}
@media print{
  @page{size:1920px 1080px;margin:0;}
  body{margin:0;}
  .informe-slide{page-break-after:always;break-after:page;}
  .informe-noprint{display:none !important;}
}
`;

export function piePagina(clienteNombre: string, etiquetaSeccion: string, logoSrc: string) {
  return `<div style="position:absolute;left:104px;right:104px;bottom:40px;display:flex;justify-content:space-between;align-items:center;font:400 16px 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.02em;color:var(--text-faint);"><span><img src="${logoSrc}" alt="bigbuda" style="height:15px;vertical-align:-2px;opacity:0.92;"> · ${esc(clienteNombre)}</span><span style="letter-spacing:0.30em;text-transform:uppercase;font-size:14px;color:var(--text-dim);">${esc(etiquetaSeccion)}</span></div>`;
}

export function etiquetaSeccion(texto: string) {
  return `<div style="font:500 20px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.36em;text-transform:uppercase;color:var(--accent);">${esc(texto)}</div>`;
}

export function barraAcento() {
  return `<div style="width:60px;height:3px;background:var(--accent);margin-top:22px;border-radius:2px;"></div>`;
}
