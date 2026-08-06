import { SiteNav } from "@/components/site-nav";

export default function MakerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="maker-bg min-h-screen">
      <SiteNav />
      {children}
    </div>
  );
}
