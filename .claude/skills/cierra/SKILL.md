---
name: cierra
description: Cierra una optimización de Ads (Meta/Google) entregando la respuesta final en el formato exacto que Kaizen Bigbuda espera pegar (## RESUMEN, ## HALLAZGOS, ## PLAN con bloque json). Úsala cuando el usuario escriba /cierra o pida cerrar/terminar la optimización.
---

# /cierra — Formato de cierre de optimización

Entrega la respuesta final de la optimización en el formato de abajo. La persona la **pega tal cual en Kaizen** (pantalla de la optimización → "Pegar respuesta"), así que el formato debe respetarse exacto: el parser (`lib/agente/respuesta.ts`) busca las tres secciones por su título.

## Antes de responder

1. Resume solo lo que realmente se analizó o decidió en esta conversación. No inventes datos: si algo no se pudo ver, dilo en el resumen o los hallazgos.
2. Incluye en el plan lo que queda **en espera de datos** (con fecha de revisión) y lo pendiente, para que la próxima optimización lo encuentre.
3. Si falta información para cerrar (por ejemplo, no se acordó qué cambios se ejecutaron), pregunta antes de entregar el formato.

## Formato (respétalo exacto, sin texto antes ni después)

````
## RESUMEN
Texto para la bitácora del cliente: qué se hizo y decidió esta semana, claro y sin relleno, en párrafos cortos o viñetas. Lenguaje de negocio; no cites las reuniones con el cliente.

## HALLAZGOS
Hallazgos relevantes del análisis (opcional; deja la sección con una línea si no hay).

## PLAN
```json
[
  {
    "id": "identificador-corto",
    "prioridad": "alta",
    "tipo": "accion",
    "titulo": "…",
    "detalle": "qué hacer exacto, por qué (con el dato) y cómo medir el efecto"
  },
  {
    "id": "otro-id",
    "prioridad": "media",
    "tipo": "esperar_datos",
    "titulo": "…",
    "detalle": "…",
    "revisarEn": "2026-11-06"
  }
]
```
````

## Reglas del bloque PLAN

- Arreglo json de **máximo 12 ítems**, de mayor a menor prioridad.
- `id`: único, corto (máx. 40 caracteres). Si se re-pega la respuesta, los ítems con el mismo id conservan su estado.
- `prioridad`: `alta` | `media` | `baja`.
- `tipo`: `accion` (algo por ejecutar) | `esperar_datos` (se deja en espera) | `revisar` (volver a mirar algo).
- `titulo`: 3 a 140 caracteres. `detalle`: 3 a 1200 caracteres.
- `revisarEn`: fecha `YYYY-MM-DD`, **solo** para `esperar_datos` y `revisar` (en `accion` se omite).
- JSON válido: comillas dobles, sin comentarios ni comas finales. Si el bloque es inválido, Kaizen no carga el plan.

## Qué pasa al pegarlo en Kaizen

- `## RESUMEN` y `## HALLAZGOS` quedan como borrador editable y, al cerrar, van a la bitácora del cliente (ClickUp + interna).
- Lo que quede `pendiente` en el plan al cerrar pasa a `proximos_pasos`; la próxima semana el briefing lo trae como heredado.
- Sin `## RESUMEN` ni `## PLAN` Kaizen rechaza el texto; sin `## RESUMEN` solo, avisa que hay que escribirlo a mano.
