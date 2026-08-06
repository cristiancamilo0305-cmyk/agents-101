import { ChatPanel } from "@/components/chat-panel";

export default function BaltimorePage() {
  return (
    <ChatPanel
      title="Baltimore — Consultoría"
      api="/api/chat/consultoria/baltimore"
      backHref="/consultoria"
      backLabel="← Clientes"
      accent="blue"
      headerLinks={[
        {
          href: "/consultoria/baltimore/gmail",
          label: "Bandeja Gmail →",
        },
      ]}
    />
  );
}
