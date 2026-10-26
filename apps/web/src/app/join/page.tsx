import { SiteNav } from "@/components/SiteChrome";
import { JoinFlow } from "./JoinFlow";

export const metadata = { title: "Join" };

export default function JoinPage() {
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />
      <JoinFlow />
    </main>
  );
}
