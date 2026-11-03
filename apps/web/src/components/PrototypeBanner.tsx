const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export function PrototypeBanner() {
  return (
    <div className="bg-sun text-ink text-xs font-semibold text-center px-3 py-1.5" role="note">
      {live
        ? "Development version · real test accounts · no payments or real videos yet"
        : "Prototype · sample data only · no real accounts, payments or videos are connected"}
    </div>
  );
}
