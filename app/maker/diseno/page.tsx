import { MakerChatPanel } from "@/components/maker-chat-panel";

export default function DesignPage() {
  return (
    <MakerChatPanel
      title="Diseño — Renders para Maker 3D"
      api="/api/chat/maker/design"
      description="Escribe tu idea (florero, bandeja, centro de mesa…) y genera un render de referencia."
      placeholder="Describe el diseño que quieres…"
      defaultPrompt="Genera una variación de diseño basada en esta imagen de referencia, manteniendo un estilo similar."
    />
  );
}
