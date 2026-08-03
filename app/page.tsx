import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-md text-sm text-muted">
        Kaizen Bigbuda — primera pantalla importada desde Claude Design: ficha de cliente.
      </p>
      <Link href="/clientes/demo" className="text-sm font-semibold text-accent">
        Ver ficha de cliente de ejemplo →
      </Link>
    </div>
  );
}
