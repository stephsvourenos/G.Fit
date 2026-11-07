import { Suspense } from "react";
import { Statement } from "./Statement";

export const metadata = { title: "Creator statement" };

export default function StatementPage() {
  return (
    <Suspense fallback={<main className="p-8 text-ink/60">Loading statement…</main>}>
      <Statement />
    </Suspense>
  );
}
