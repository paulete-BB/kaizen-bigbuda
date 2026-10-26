-- Las optimizaciones de posicionamiento (SEO · AEO · GEO) las lleva Marcel en
-- su propio sistema; Kaizen deja de programarlas (ver lib/config.ts). Las que
-- ya estaban pendientes se cancelan (no se borran: el historial de las
-- realizadas queda intacto y estas se pueden reactivar a mano si hace falta).
-- Cancelada sale solo de las alertas, del calendario y del job de reintento.
update optimizations
set estado = 'cancelada', bloqueada_motivo = null, actualizado_en = now()
where tipo = 'seo_aeo_geo' and estado in ('programada', 'atrasada', 'bloqueada');
