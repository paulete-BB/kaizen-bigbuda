/**
 * Paleta categórica validada (dataviz skill, orden fijo por identidad —
 * nunca reciclada según qué fuentes aparezcan en el período). Compartida
 * entre los charts de tráfico IA de Resultados (§3.15). Sin dependencias
 * de servidor para poder importarse desde componentes cliente.
 */
const COLOR_POR_FUENTE: Record<string, string> = {
  "chatgpt.com": "#2a78d6",
  "chat.openai.com": "#2a78d6",
  "perplexity.ai": "#eb6834",
  "gemini.google.com": "#1baf7a",
  "claude.ai": "#eda100",
  "copilot.microsoft.com": "#e87ba4",
};
const COLOR_OTRA_FUENTE = "#9ca3af";

export function colorFuenteIA(fuente: string): string {
  const match = Object.keys(COLOR_POR_FUENTE).find((dominio) => fuente.toLowerCase().includes(dominio));
  return match ? COLOR_POR_FUENTE[match] : COLOR_OTRA_FUENTE;
}
