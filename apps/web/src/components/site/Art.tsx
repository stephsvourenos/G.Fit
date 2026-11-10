import { avatarById, stillSvg, type CategoryId } from "@app/domain";

/** Gear picture used as each category's artwork on the public site (same library as the profile pictures). */
export const CATEGORY_ART: Record<CategoryId, string> = {
  dance: "@star",
  "move-and-play": "@bolt",
  pilates: "@mat",
  soccer: "@socc",
  mobility: "@peak",
  strength: "@kettl",
  challenges: "@troph",
};

/** One library picture as an inline square. Library SVGs are our own constants, never user input. */
export function Art({ id, size, still = true, className = "" }: { id: string; size: number; still?: boolean; className?: string }) {
  const a = avatarById(id);
  if (!a) return null;
  return (
    <span
      aria-hidden
      className={`block shrink-0 overflow-hidden rounded-[28%] [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: still ? stillSvg(a.svg) : a.svg }}
    />
  );
}
