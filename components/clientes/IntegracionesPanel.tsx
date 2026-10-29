"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfigApis } from "@/lib/data/cliente-detalle";
import { guardarConfigApis } from "@/lib/data/cliente-actions";
import { probarConexionAds } from "@/lib/data/google-ads-actions";

export function IntegracionesPanel({ clientId, configApis }: { clientId: string; configApis: ConfigApis }) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    gscProperty: configApis.gscProperty ?? "",
    ga4PropertyId: configApis.ga4PropertyId ?? "",
    googleAdsGa4PropertyId: configApis.googleAdsGa4PropertyId ?? "",
    metaAdsGa4PropertyId: configApis.metaAdsGa4PropertyId ?? "",
    metaAdAccountId: configApis.metaAdAccountId ?? "",
    fbPageId: configApis.fbPageId ?? "",
    igAccountId: configApis.igAccountId ?? "",
    metaTokenKey: configApis.metaTokenKey ?? "",
    googleAdsCustomerId: configApis.googleAdsCustomerId ?? "",
  });
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setGuardado(false);
  }

  async function probar() {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await probarConexionAds(clientId));
    } finally {
      setProbando(false);
    }
  }

  async function guardar() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("clientId", clientId);
    Object.entries(draft).forEach(([k, v]) => fd.set(k, v));
    try {
      const res = await guardarConfigApis(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Integraciones de datos (GSC · GA4 · Meta)</span>
      </div>

      {error && <div className="border-b border-danger-border bg-danger-bg px-[18px] py-2 text-[12px] font-semibold text-danger">{error}</div>}

      <div className="flex flex-col gap-3 px-[18px] py-[15px]">
        <p className="text-[11.5px] text-muted-2">
          Mismos identificadores que usaba el dashboard de resultados anterior — se pueden completar acá o importar desde
          /ajustes.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Propiedad GSC (sc-domain: o URL)" value={draft.gscProperty} onChange={(v) => set("gscProperty", v)} placeholder="sc-domain:ejemplo.cl" />
          <Campo label="GA4 Property ID (sitio principal)" value={draft.ga4PropertyId} onChange={(v) => set("ga4PropertyId", v)} placeholder="123456789" />
          <Campo
            label="GA4 Property ID (landing de Google Ads)"
            value={draft.googleAdsGa4PropertyId}
            onChange={(v) => set("googleAdsGa4PropertyId", v)}
            placeholder="Solo si las campañas apuntan a una landing con GA4 propio"
          />
          <Campo
            label="GA4 Property ID (landing de Meta Ads)"
            value={draft.metaAdsGa4PropertyId}
            onChange={(v) => set("metaAdsGa4PropertyId", v)}
            placeholder="Solo si Meta Ads no apunta al sitio principal — si no, se usa el de arriba"
          />
          <Campo label="Meta Ad Account ID" value={draft.metaAdAccountId} onChange={(v) => set("metaAdAccountId", v)} placeholder="act_123456789 o 123456789" />
          <Campo label="Facebook Page ID" value={draft.fbPageId} onChange={(v) => set("fbPageId", v)} placeholder="" />
          <Campo label="Instagram Account ID" value={draft.igAccountId} onChange={(v) => set("igAccountId", v)} placeholder="" />
          <Campo
            label="ID de cuenta de Google Ads"
            value={draft.googleAdsCustomerId}
            onChange={(v) => set("googleAdsCustomerId", v)}
            placeholder="738-056-4660 — para traer los datos directo de Google Ads"
          />
          <Campo
            label="Token de Meta alternativo (opcional)"
            value={draft.metaTokenKey}
            onChange={(v) => set("metaTokenKey", v)}
            placeholder="Solo si este cliente usa su propio System User"
          />
        </div>
        <p className="text-[11px] text-muted-2">
          La sección Google Ads (informes y Resultados) usa la propiedad de la landing si está configurada; si no, no
          muestra datos de Google Ads — las campañas de Google Ads no apuntan al sitio principal, así que reusar esa
          propiedad daba números que no coincidían con Google Ads directo. Meta Ads es al revés: casi siempre apunta al
          sitio principal (arriba), así que el campo de su landing es opcional — complétalo solo si este cliente en
          particular manda las campañas de Meta a una landing propia (sin ese dato, el cruce de conversiones reales con
          GA4 cae al conteo de Meta, que puede no ser preciso).
        </p>
        {configApis.googleAdsCustomerId && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={probar} disabled={probando} className="ghost rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-ink disabled:opacity-60">
              {probando ? "Probando…" : "Probar conexión con Google Ads"}
            </button>
            {prueba && <span className={`text-[12px] font-semibold ${prueba.ok ? "text-success" : "text-danger"}`}>{prueba.mensaje}</span>}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={guardar} disabled={pending} className="btn-primary self-start rounded-lg border-none bg-accent px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {guardado && <span className="text-[12px] font-semibold text-success">Guardado.</span>}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-muted-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
      />
    </label>
  );
}
