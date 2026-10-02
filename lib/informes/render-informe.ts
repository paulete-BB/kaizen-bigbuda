import { fmtMesAnio, type InformeAdsCombinadoContenido, type InformeMarketingContenido, type InformeSeoContenido } from "@/lib/informes/tipos";
import { renderSlidesSeo } from "@/lib/informes/slides-seo";
import { renderSlidesMarketing, type ServicioAdsTipo } from "@/lib/informes/slides-marketing";
import { renderSlidesAdsCombinado } from "@/lib/informes/slides-ads-combinado";
import type { InformeCompleto } from "@/lib/data/informes";

const LOGO_SRC = "/informes/logo-bigbuda.svg";

/** Arma las slides HTML de un informe ya cargado, según su tipo de servicio. */
export function renderSlidesInforme(informe: InformeCompleto): string[] {
  const mesAnioLabel = fmtMesAnio(informe.periodoMes, informe.periodoAnio);
  const fechaSnapshotLabel = new Date().toLocaleDateString("es-CL");
  const base = {
    clienteNombre: informe.clienteNombre,
    clienteEmpresa: informe.clienteEmpresa,
    contactoNombre: informe.contactoNombre,
    sitioWeb: informe.sitioWeb,
    mesAnioLabel,
    fechaSnapshotLabel,
    logoSrc: LOGO_SRC,
  };

  if (informe.tipo === "seo_aeo_geo") {
    return renderSlidesSeo({ ...base, contenido: informe.contenido as InformeSeoContenido });
  }

  if (informe.tipo === "ads_combinado") {
    return renderSlidesAdsCombinado({ ...base, contenido: informe.contenido as InformeAdsCombinadoContenido });
  }

  return renderSlidesMarketing({ ...base, servicioTipo: informe.tipo as ServicioAdsTipo, contenido: informe.contenido as InformeMarketingContenido });
}
