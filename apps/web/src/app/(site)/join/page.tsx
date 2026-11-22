import type { Metadata } from "next";
import { PageHero } from "@/components/site/ui";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Join",
  description: "Join G.Fit just for you, or for everyone at home. Start with a 7-day free trial.",
  alternates: { canonical: "/join/" },
};

export default function JoinPage() {
  return (
    <main>
      <PageHero eyebrow="Get started" title="Let’s find your fit." crumbs={[{ label: "Join" }]}
        lead="Whether it’s just you or everyone at home, you get the same full G.Fit experience." />
      <JoinFlow />
    </main>
  );
}
