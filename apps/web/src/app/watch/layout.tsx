import { HouseholdProvider } from "@/lib/household";

export const metadata = { title: "Watch" };

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <div className="flex flex-1 flex-col bg-ink text-paper">{children}</div>
    </HouseholdProvider>
  );
}
