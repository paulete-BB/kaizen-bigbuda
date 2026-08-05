import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/passwords";
import { construirCalendarioMes } from "@/lib/scheduling/engine";
import type { Absence, Holiday, ServicioActivo } from "@/lib/scheduling/types";

const DEV_PASSWORD = "Bigbuda2026!";

// Feriados de Chile 2026 (fijos + los ya usados en el prototipo de diseño).
const HOLIDAYS_2026: Holiday[] = [
  { fecha: "2026-01-01", nombre: "Año Nuevo" },
  { fecha: "2026-04-03", nombre: "Viernes Santo" },
  { fecha: "2026-04-04", nombre: "Sábado Santo" },
  { fecha: "2026-05-01", nombre: "Día del Trabajo" },
  { fecha: "2026-05-21", nombre: "Día de las Glorias Navales" },
  { fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2026-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2026-09-18", nombre: "Independencia Nacional" },
  { fecha: "2026-09-19", nombre: "Glorias del Ejército" },
  { fecha: "2026-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2026-10-31", nombre: "Iglesias Evangélicas y Protestantes" },
  { fecha: "2026-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2026-12-25", nombre: "Navidad" },
];

const DEMO_YEAR = 2026;
const DEMO_MONTH = 9; // septiembre — incluye el feriado del 18 (Fiestas Patrias, cae viernes)

async function reset() {
  await sql`truncate table
    approval_reminders, approvals, log_entries, reschedules, checklist_items,
    checklist_instances, optimizations, budgets, client_tasks, discounts,
    service_renewals, services, clients, absences, users, holidays
    restart identity cascade`;
}

async function seedUsers() {
  const hash = await hashPassword(DEV_PASSWORD);
  const [marcel] = await sql`
    insert into users (nombre, email, rol, iniciales, color, password_hash)
    values ('Marcel', 'marcel@bigbuda.com', 'admin', 'MA', '#a86f1c', ${hash})
    returning id
  `;
  const [paulete] = await sql`
    insert into users (nombre, email, rol, iniciales, color, password_hash)
    values ('Paulete', 'paulete@bigbuda.com', 'miembro', 'PA', '#0f766e', ${hash})
    returning id
  `;
  const [andres] = await sql`
    insert into users (nombre, email, rol, iniciales, color, password_hash)
    values ('Andrés', 'andres@bigbuda.com', 'miembro', 'AN', '#2563eb', ${hash})
    returning id
  `;
  return { marcel: marcel.id as string, paulete: paulete.id as string, andres: andres.id as string };
}

async function seedHolidays() {
  for (const h of HOLIDAYS_2026) {
    await sql`insert into holidays (fecha, nombre, anio) values (${h.fecha}, ${h.nombre ?? ""}, ${DEMO_YEAR})`;
  }
}

async function seedAbsence(userId: string) {
  await sql`
    insert into absences (user_id, fecha_inicio, fecha_fin, motivo)
    values (${userId}, '2026-09-14', '2026-09-18', 'Vacaciones')
  `;
}

interface ClienteSeed {
  id: string;
  nombre: string;
}

async function seedClients() {
  const [filtrocentro] = await sql`
    insert into clients (nombre, empresa, contacto_nombre, contacto_email, contacto_telefono, sitio_web, industria, estado)
    values ('Filtrocentro', 'Filtrocentro Ltda.', 'Camila Rojas', 'contacto@filtrocentro.cl', '+56 9 7234 1190', 'filtrocentro.cl', 'Filtración industrial', 'activo')
    returning id
  `;
  const [provetec] = await sql`
    insert into clients (nombre, empresa, contacto_nombre, contacto_email, contacto_telefono, sitio_web, industria, estado)
    values ('Provetec Mining', 'Provetec Mining SpA', 'Rodrigo Méndez', 'contacto@provetec.cl', '+56 9 8123 4567', 'provetec.cl', 'Minería y filtración', 'activo')
    returning id
  `;
  const [tecnyStand] = await sql`
    insert into clients (nombre, empresa, contacto_nombre, contacto_email, contacto_telefono, sitio_web, industria, estado)
    values ('Tecny Stand', 'Tecny Stand SpA', 'Valentina Soto', 'contacto@tecnystand.cl', '+56 9 5561 2280', 'tecnystand.cl', 'Stands y ferias', 'activo')
    returning id
  `;
  return {
    filtrocentro: { id: filtrocentro.id as string, nombre: "Filtrocentro" } satisfies ClienteSeed,
    provetec: { id: provetec.id as string, nombre: "Provetec Mining" } satisfies ClienteSeed,
    tecnyStand: { id: tecnyStand.id as string, nombre: "Tecny Stand" } satisfies ClienteSeed,
  };
}

async function seedServices(
  clients: Awaited<ReturnType<typeof seedClients>>,
  responsables: Awaited<ReturnType<typeof seedUsers>>,
) {
  const [seoFiltrocentro] = await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, responsable_id)
    values (${clients.filtrocentro.id}, 'seo_aeo_geo', '2026-01-12', 12, '2027-01-12', ${responsables.marcel})
    returning id
  `;
  const [seoProvetec] = await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, viernes_ordinal_asignado, responsable_id)
    values (${clients.provetec.id}, 'seo_aeo_geo', '2026-03-12', 12, '2027-03-12', 3, ${responsables.marcel})
    returning id
  `;
  const [googleProvetec] = await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, presupuesto_mensual, moneda, responsable_id)
    values (${clients.provetec.id}, 'google_ads', '2026-04-15', 12, '2027-04-15', 900000, 'CLP', ${responsables.andres})
    returning id
  `;
  const [metaTecnyStand] = await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, presupuesto_mensual, moneda, responsable_id)
    values (${clients.tecnyStand.id}, 'meta_ads', '2026-05-01', 6, '2026-11-01', 1200000, 'CLP', ${responsables.andres})
    returning id
  `;
  const [googleTecnyStand] = await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, presupuesto_mensual, moneda, responsable_id)
    values (${clients.tecnyStand.id}, 'google_ads', '2026-05-01', 6, '2026-11-01', 800000, 'CLP', ${responsables.andres})
    returning id
  `;

  const serviciosSeo: ServicioActivo[] = [
    { id: seoFiltrocentro.id, clientId: clients.filtrocentro.id, tipo: "seo_aeo_geo", responsableId: responsables.marcel },
    {
      id: seoProvetec.id,
      clientId: clients.provetec.id,
      tipo: "seo_aeo_geo",
      viernesOrdinalAsignado: 3,
      responsableId: responsables.marcel,
    },
  ];
  const serviciosAds: ServicioActivo[] = [
    { id: googleProvetec.id, clientId: clients.provetec.id, tipo: "google_ads", responsableId: responsables.andres },
    { id: metaTecnyStand.id, clientId: clients.tecnyStand.id, tipo: "meta_ads", responsableId: responsables.andres },
    { id: googleTecnyStand.id, clientId: clients.tecnyStand.id, tipo: "google_ads", responsableId: responsables.andres },
  ];

  return { serviciosSeo, serviciosAds, googleProvetec: googleProvetec.id as string, metaTecnyStand: metaTecnyStand.id as string, googleTecnyStand: googleTecnyStand.id as string };
}

async function seedDiscounts(clients: Awaited<ReturnType<typeof seedClients>>) {
  await sql`
    insert into discounts (client_id, descripcion, tipo, valor, fecha_inicio, fecha_termino)
    values (${clients.provetec.id}, 'Descuento onboarding', 'pct', 10, '2026-03-12', '2026-09-30')
  `;
  await sql`
    insert into discounts (client_id, descripcion, tipo, valor, fecha_inicio, fecha_termino)
    values (${clients.provetec.id}, 'Bono fidelidad', 'pct', 15, '2026-06-01', '2026-12-12')
  `;
}

async function seedClientTasks(clients: Awaited<ReturnType<typeof seedClients>>, responsables: Awaited<ReturnType<typeof seedUsers>>) {
  await sql`
    insert into client_tasks (client_id, titulo, destino, servicio_tipo, responsable_id)
    values (${clients.provetec.id}, 'Revisar canibalización entre fichas de filtros prensa y filtros de manga', 'checklist', 'seo_aeo_geo', ${responsables.marcel})
  `;
  await sql`
    insert into client_tasks (client_id, titulo, destino, frecuencia, servicio_tipo, responsable_id)
    values (${clients.provetec.id}, 'Chequear negativas nuevas y términos de búsqueda del mes', 'recurrente', 'Cada mes', 'google_ads', ${responsables.andres})
  `;
}

async function seedBudgets(servicios: Awaited<ReturnType<typeof seedServices>>) {
  const filas = [
    { id: servicios.googleProvetec, presupuesto: 900000, gasto: 693000 },
    { id: servicios.metaTecnyStand, presupuesto: 1200000, gasto: 540000 },
    { id: servicios.googleTecnyStand, presupuesto: 800000, gasto: 210000 },
  ];
  for (const f of filas) {
    const pacing = Math.round((f.gasto / f.presupuesto) * 100);
    await sql`
      insert into budgets (service_id, mes, anio, presupuesto, moneda, gasto_acumulado, pacing_pct, alerta_disparada)
      values (${f.id}, ${DEMO_MONTH}, ${DEMO_YEAR}, ${f.presupuesto}, 'CLP', ${f.gasto}, ${pacing}, ${pacing >= 115 || pacing <= 85})
    `;
  }
}

async function seedApprovals(clients: Awaited<ReturnType<typeof seedClients>>) {
  await sql`
    insert into approvals (client_id, tipo, descripcion, enviado_en, canal, estado)
    values (${clients.tecnyStand.id}, 'creativo', 'Nuevos creativos de campaña de aniversario', '2026-09-08', 'email', 'sin_respuesta')
  `;
}

async function seedLogEntries(clients: Awaited<ReturnType<typeof seedClients>>, responsables: Awaited<ReturnType<typeof seedUsers>>) {
  const entradas = [
    {
      titulo: "Optimización Google Ads",
      tipo: "Optimización",
      contenido: "Redistribución de presupuesto por sobregasto (+22%). Se acotó campaña Search.",
      fecha: "2026-07-22",
      sync: "pendiente_sync" as const,
      creadoPor: responsables.andres,
    },
    {
      titulo: "Optimización SEO · AEO · GEO",
      tipo: "Optimización",
      contenido: "FAQs y datos estructurados nuevos, mejora de títulos, ficha GEO actualizada. Informe enviado el 2026-07-17.",
      fecha: "2026-07-17",
      sync: "ok" as const,
      creadoPor: responsables.marcel,
    },
  ];
  for (const e of entradas) {
    await sql`
      insert into log_entries (client_id, titulo, tipo, contenido, sync_status, creado_por, creado_en)
      values (${clients.provetec.id}, ${e.titulo}, ${e.tipo}, ${e.contenido}, ${e.sync}, ${e.creadoPor}, ${e.fecha}::date)
    `;
  }
}

// Julio (mes ya transcurrido, para poblar historial/atrasadas) → agosto
// (mes real actual, para "hoy/esta semana") → septiembre (mes de demo con
// el feriado). El reloj real del sandbox está en agosto de 2026.
const MESES_A_GENERAR: { year: number; month: number }[] = [
  { year: 2026, month: 7 },
  { year: 2026, month: 8 },
  { year: DEMO_YEAR, month: DEMO_MONTH },
];

async function seedCalendario(
  servicios: Awaited<ReturnType<typeof seedServices>>,
  holidays: Holiday[],
  absences: Absence[],
) {
  let serviciosSeo = servicios.serviciosSeo;
  const idsPorMes = new Map<string, string[]>();

  for (const { year, month } of MESES_A_GENERAR) {
    const { optimizaciones, asignacionesOrdinal, advertencias } = construirCalendarioMes({
      serviciosSeo,
      serviciosAds: servicios.serviciosAds,
      holidays,
      absences,
      year,
      month,
    });

    // Persistir los ordinales recién asignados y llevarlos al siguiente mes
    // (estables: nunca se reasignan una vez fijados).
    const ordinalPorServicio = new Map(asignacionesOrdinal.map((a) => [a.serviceId, a.ordinal]));
    for (const a of asignacionesOrdinal) {
      await sql`update services set viernes_ordinal_asignado = ${a.ordinal} where id = ${a.serviceId}`;
    }
    serviciosSeo = serviciosSeo.map((s) => ({
      ...s,
      viernesOrdinalAsignado: ordinalPorServicio.get(s.id) ?? s.viernesOrdinalAsignado,
    }));

    const ids: string[] = [];
    for (const o of optimizaciones) {
      const [row] = await sql`
        insert into optimizations (
          client_id, service_id, tipo, fecha_programada, hora_programada,
          responsable_id, estado, sync_status
        ) values (
          ${o.clientId}, ${o.serviceId}, ${o.tipo}, ${o.fechaProgramada}, ${o.horaProgramada ?? null},
          ${o.responsableId ?? null}, 'programada', 'pendiente_sync'
        ) returning id
      `;
      ids.push(row.id as string);
      if (o.reprogramada) {
        await sql`
          insert into reschedules (optimization_id, fecha_original, fecha_nueva, motivo)
          values (${row.id}, ${o.reprogramada.fechaOriginal}, ${o.fechaProgramada}, ${o.reprogramada.motivo})
        `;
      }
    }
    idsPorMes.set(`${year}-${month}`, ids);

    console.log(`  ${year}-${String(month).padStart(2, "0")}: ${optimizaciones.length} optimizaciones` +
      `, ${optimizaciones.filter((o) => o.reprogramada).length} reprogramadas por feriado` +
      `, ${optimizaciones.filter((o) => o.conflictoAusencia).length} con conflicto de ausencia`);
    if (advertencias.length) console.log("    advertencias:", advertencias);
  }

  // Julio ya pasó: la mayoría queda "realizada" (con su registro), un par
  // queda "programada" sin completar → hoy se ve real y atrasada.
  const julioIds = idsPorMes.get("2026-7") ?? [];
  const atrasadasIds = julioIds.slice(0, 2);
  const realizadasIds = julioIds.slice(2);

  if (realizadasIds.length) {
    await sql`
      update optimizations set
        estado = 'realizada',
        fecha_realizada = fecha_programada,
        resumen = 'Optimización ejecutada según checklist estándar.',
        proximos_pasos = 'Monitorear resultados del cambio en el próximo ciclo.',
        informe_enviado_en = case when tipo = 'seo_aeo_geo' then fecha_programada else informe_enviado_en end,
        sync_status = 'ok'
      where id in ${sql(realizadasIds)}
    `;
  }
  if (atrasadasIds.length) {
    await sql`update optimizations set estado = 'programada' where id in ${sql(atrasadasIds)}`;
  }
}

async function main() {
  console.log("→ Reseteando datos de demo…");
  await reset();

  console.log("→ Usuarios…");
  const responsables = await seedUsers();

  console.log("→ Feriados 2026…");
  await seedHolidays();
  await seedAbsence(responsables.andres);

  console.log("→ Clientes de prueba (Filtrocentro, Provetec Mining, Tecny Stand)…");
  const clients = await seedClients();

  console.log("→ Servicios…");
  const servicios = await seedServices(clients, responsables);

  console.log("→ Descuentos, tareas, presupuestos, aprobaciones, bitácora…");
  await seedDiscounts(clients);
  await seedClientTasks(clients, responsables);
  await seedBudgets(servicios);
  await seedApprovals(clients);
  await seedLogEntries(clients, responsables);

  console.log("→ Calendario jul–sep 2026 (motor de scheduling, reglas A/B/D)…");
  await seedCalendario(
    servicios,
    HOLIDAYS_2026,
    [{ userId: responsables.andres, fechaInicio: "2026-09-14", fechaFin: "2026-09-18" }],
  );

  console.log("\nListo. Login de prueba:");
  console.log(`  marcel@bigbuda.com / ${DEV_PASSWORD}  (admin)`);
  console.log(`  andres@bigbuda.com / ${DEV_PASSWORD}  (miembro)`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
