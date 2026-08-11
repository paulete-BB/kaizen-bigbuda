import { fmtMesAnio, type InformeMarketingContenido, type InformeSeoContenido } from "@/lib/informes/tipos";
import { renderSlidesSeo } from "@/lib/informes/slides-seo";
import { renderSlidesMarketing, type ServicioAdsTipo } from "@/lib/informes/slides-marketing";
import type { InformeCompleto } from "@/lib/data/informes";

const LOGO_SRC = "/informes/logo-bigbuda.svg";

/** Arma las slides HTML de un informe ya cargado, según su tipo de servicio. */
export function renderSlidesInforme(informe: InformeCompleto): string[] {
  const mesAnioLabel = fmtMesAnio(informe.periodoMes, informe.periodoAnio);
  const fechaSnapshotLabel = new Date().toLocaleDateString("es-CL");

  if (informe.tipo === "seo_aeo_geo") {
    return renderSlidesSeo({
      clienteNombre: informe.clienteNombre,
      clienteEmpresa: informe.clienteEmpresa,
      contactoNombre: informe.contactoNombre,
      sitioWeb: informe.sitioWeb,
      mesAnioLabel,
      fechaSnapshotLabel,
      logoSrc: LOGO_SRC,
      contenido: informe.contenido as InformeSeoContenido,
    });
  }

  return renderSlidesMarketing({
    clienteNombre: informe.clienteNombre,
    clienteEmpresa: informe.clienteEmpresa,
    contactoNombre: informe.contactoNombre,
    sitioWeb: informe.sitioWeb,
    mesAnioLabel,
    fechaSnapshotLabel,
    logoSrc: LOGO_SRC,
    servicioTipo: informe.tipo as ServicioAdsTipo,
    contenido: informe.contenido as InformeMarketingContenido,
  });
}
