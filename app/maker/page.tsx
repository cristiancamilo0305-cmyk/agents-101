import { MakerChatPanel } from "@/components/maker-chat-panel";

export default function MakerPage() {
  return (
    <MakerChatPanel
      title="Maker 3D — Diseño e impresión"
      api="/api/chat/maker"
      backHref="/"
      backLabel="← Inicio"
    />
  );
}
