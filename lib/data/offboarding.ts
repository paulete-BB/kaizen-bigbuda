import { sql } from "@/lib/db";

export interface OffboardingItem {
  id: string;
  descripcion: string;
  estado: "pendiente" | "completado";
  bloqueante: boolean;
}

export interface OffboardingResumen {
  porcentaje: number;
  totalItems: number;
  completados: number;
  items: OffboardingItem[];
}

/**
 * Devuelve el checklist de cierre §3.12 de un cliente. A diferencia de
 * `getOnboardingCliente`, no instancia nada perezosamente acá — el disparador
 * real es `registrarSalidaCliente` (§3.1/§3.12), al momento de marcar la
 * salida. Esta función solo lee lo que ya exista (vacío si el cliente nunca
 * se dio de baja).
 */
export async function getOffboardingCliente(clientId: string): Promise<OffboardingResumen> {
  const items = await sql<
    { id: string; descripcion: string; estado: OffboardingItem["estado"]; bloqueante: boolean }[]
  >`
    select ci.id, ci.descripcion,
           (case when ci.estado = 'completado' then 'completado' else 'pendiente' end) as estado,
           coalesce(cit.bloqueante, false) as bloqueante
    from checklist_items ci
    join checklist_instances inst on inst.id = ci.instance_id
    left join checklist_items_template cit on cit.template_id = inst.template_id and cit.orden = ci.orden
    where inst.client_id = ${clientId} and inst.template_id in (
      select id from checklist_templates where tipo = 'offboarding'
    )
    order by ci.orden
  `;

  const completados = items.filter((i) => i.estado === "completado").length;
  return {
    porcentaje: items.length ? Math.round((completados / items.length) * 100) : 0,
    totalItems: items.length,
    completados,
    items,
  };
}

/**
 * Instancia el checklist de cierre para los servicios que el cliente
 * tiene (activos o pausados — al momento de cerrar puede que ya estén
 * pausados manualmente). Idempotente por plantilla, mismo patrón que
 * `instanciarOnboarding`: un cliente ya finalizado antes de que existiera
 * esta funcionalidad puede instanciarla recién ahora sin duplicar nada si
 * se vuelve a llamar.
 *
 * `marcarBloqueantesCompletados`: cuando "Salida de cliente" ya confirmó
 * los ítems bloqueantes en el mismo drawer (informe final, cliente
 * notificado, campañas pausadas — ver `lib/offboarding-items.ts`), esos
 * ítems nacen `completado` en vez de `pendiente`; el resto (bitácora
 * archivada, accesos por revocar) sigue naciendo `pendiente` para
 * completarse después desde la ficha.
 */
export async function instanciarOffboarding(clientId: string, opts: { marcarBloqueantesCompletados?: boolean } = {}) {
  const serviciosDelCliente = await sql<{ tipo: string }[]>`
    select distinct tipo from services where client_id = ${clientId}
  `;

  const templates = await sql<{ id: string; servicio_tipo: string | null }[]>`
    select id, servicio_tipo from checklist_templates
    where tipo = 'offboarding'
      and (servicio_tipo is null or servicio_tipo = any(${serviciosDelCliente.map((s) => s.tipo)}))
  `;

  const yaInstanciados = await sql<{ template_id: string }[]>`
    select template_id from checklist_instances where client_id = ${clientId}
      and template_id in (select id from checklist_templates where tipo = 'offboarding')
  `;
  const yaInstanciadosSet = new Set(yaInstanciados.map((r) => r.template_id));

  for (const tpl of templates) {
    if (yaInstanciadosSet.has(tpl.id)) continue;
    const [instance] = await sql<{ id: string }[]>`
      insert into checklist_instances (template_id, client_id, estado)
      values (${tpl.id}, ${clientId}, 'en_progreso')
      returning id
    `;
    const itemsTemplate = await sql<{ descripcion: string; orden: number; bloqueante: boolean }[]>`
      select descripcion, orden, bloqueante from checklist_items_template where template_id = ${tpl.id} order by orden
    `;
    for (const it of itemsTemplate) {
      const estado = opts.marcarBloqueantesCompletados && it.bloqueante ? "completado" : "pendiente";
      await sql`
        insert into checklist_items (instance_id, orden, descripcion, estado)
        values (${instance.id}, ${it.orden}, ${it.descripcion}, ${estado})
      `;
    }
  }
}
