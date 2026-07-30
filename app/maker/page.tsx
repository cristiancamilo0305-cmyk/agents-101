import { ChatPanel } from "@/components/chat-panel";

export default function MakerPage() {
  return (
    <ChatPanel
      title="Maker 3D — Diseño e impresión"
      api="/api/chat/maker"
      backHref="/"
      backLabel="← Inicio"
    />
  );
}
