import { Suspense } from "react";
import { NeedsDatabase } from "../_ui";
import { Profile } from "./Profile";

export const metadata = { title: "Prospect · Creator Acquisition" };

export default function Page() {
  return (
    <NeedsDatabase>
      <Suspense fallback={<p className="text-ink/60">Loading…</p>}><Profile /></Suspense>
    </NeedsDatabase>
  );
}
