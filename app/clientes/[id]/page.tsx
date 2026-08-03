import { ClienteView } from "@/components/clientes/ClienteView";
import { getClienteMock } from "@/lib/clientes/mock";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = getClienteMock(id);

  return <ClienteView cliente={cliente} />;
}
