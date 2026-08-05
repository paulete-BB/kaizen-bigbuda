import { sql } from "@/lib/db";

export interface OnboardingItem {
  id: string;
  descripcion: string;
  estado: "pendiente" | "solicitado" | "recibido" | "completado";
  bloqueante: boolean;
}

export interface OnboardingResumen {
  porcentaje: number;
  totalItems: number;
  completados: number;
  items: OnboardingItem[];
}

const DONE_STATES = new Set(["recibido", "completado"]);

/**
 * Devuelve el resumen del checklist de onboarding §3.8 de un cliente,
 * instanciando primero cualquier plantilla que todavía no tenga su
 * checklist_instance — de forma perezosa e idempotente **por plantilla**
 * (no solo la primera vez para el cliente completo), para que agregar un
 * servicio nuevo más adelante también le cree su propio checklist.
 */
export async function getOnboardingCliente(clientId: string): Promise<OnboardingResumen> {
  await instanciarOnboarding(clientId);

  const items = await sql<
    { id: string; descripcion: string; estado: OnboardingItem["estado"]; bloqueante: boolean }[]
  >`
    select ci.id, ci.descripcion, ci.estado, coalesce(cit.bloqueante, false) as bloqueante
    from checklist_items ci
    join checklist_instances inst on inst.id = ci.instance_id
    left join checklist_items_template cit on cit.template_id = inst.template_id and cit.orden = ci.orden
    where inst.client_id = ${clientId} and inst.template_id in (
      select id from checklist_templates where tipo = 'onboarding'
    )
    order by ci.orden
  `;

  const completados = items.filter((i) => DONE_STATES.has(i.estado)).length;
  return {
    porcentaje: items.length ? Math.round((completados / items.length) * 100) : 0,
    totalItems: items.length,
    completados,
    items,
  };
}

async function instanciarOnboarding(clientId: string) {
  const serviciosActivos = await sql<{ tipo: string }[]>`
    select distinct tipo from services where client_id = ${clientId} and not pausado
  `;
  const huboOptimizacionesRealizadas = await sql<{ existe: boolean }[]>`
    select exists(select 1 from optimizations where client_id = ${clientId} and estado = 'realizada') as existe
  `;
  const yaOperando = huboOptimizacionesRealizadas[0]?.existe ?? false;

  const templates = await sql<{ id: string; servicio_tipo: string | null }[]>`
    select id, servicio_tipo from checklist_templates
    where tipo = 'onboarding'
      and (servicio_tipo is null or servicio_tipo = any(${serviciosActivos.map((s) => s.tipo)}))
  `;

  const yaInstanciados = await sql<{ template_id: string }[]>`
    select template_id from checklist_instances where client_id = ${clientId}
  `;
  const yaInstanciadosSet = new Set(yaInstanciados.map((r) => r.template_id));

  let pendientesDejados = 0;
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
      const dejarPendiente = yaOperando && pendientesDejados < 2 && !it.bloqueante;
      const estado = dejarPendiente ? "solicitado" : yaOperando ? "recibido" : "pendiente";
      if (dejarPendiente) pendientesDejados++;
      await sql`
        insert into checklist_items (instance_id, orden, descripcion, estado)
        values (${instance.id}, ${it.orden}, ${it.descripcion}, ${estado})
      `;
    }
  }
}
