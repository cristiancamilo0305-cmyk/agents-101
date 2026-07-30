import { ChatPanel } from "@/components/chat-panel";

export default function BaltimorePage() {
  return (
    <ChatPanel
      title="Baltimore — Consultoría"
      api="/api/chat/consultoria/baltimore"
      backHref="/consultoria"
      backLabel="← Clientes"
      headerLinks={[
        {
          href: "/consultoria/baltimore/gmail",
          label: "Bandeja Gmail →",
        },
      ]}
    />
  );
}
