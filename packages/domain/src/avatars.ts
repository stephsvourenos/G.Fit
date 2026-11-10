/**
 * Profile pictures — an original illustrated library (no real people, no brands).
 *
 * Each picture is a small SVG (viewBox 0 0 100 100, square, its own background) identified by a short id
 * starting with "@" that fits the profile's avatar field (max 8 chars). Anything else in that field is an
 * emoji (the original avatars), so old profiles keep working.
 *
 * Groups (like a streaming service's picker): Movers (sporty characters, many looks), Animal athletes,
 * Gear (fitness icons) and Animated (gentle loops on the web; still on the phone app).
 * No gradients or ids inside the SVGs, so many can be on one page safely.
 */

export type AvatarGroup = "movers" | "animals" | "gear" | "animated";
export const AVATAR_GROUP_LABEL: Record<AvatarGroup, string> = {
  movers: "Movers",
  animals: "Animal athletes",
  gear: "Gear",
  animated: "On the move",
};

export interface AvatarDef {
  id: string; // "@xxxx", ≤ 8 chars
  name: string; // spoken label (accessibility)
  group: AvatarGroup;
  svg: string;
}

const INK = "#15131C";
const svg = (bg: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${body}</svg>`;

/* ------------------------------------------------------------------ Movers ------------------------------------------------------------------ */

const SKIN = { a: "#FCE0CC", b: "#F2C29E", c: "#D9A07A", d: "#B5774F", e: "#8A5534", f: "#5E3A23" } as const;
const darker = (hex: string, k = 0.82) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

type Hair = "short" | "buzz" | "long" | "bun" | "pony" | "afro" | "braids" | "curly" | "none";
type Kit = "band" | "cap" | "swim" | "helmet" | "gloves" | "medal" | "whistle" | "jersey" | "ball" | "racket" | "wrap" | "bandana" | "none";

interface Mover { skin: string; hair: Hair; hairColour: string; top: string; kit: Kit; kitColour: string; bg: string; extra?: string }

function backHair(m: Mover) {
  switch (m.hair) {
    case "long": return `<path d="M30 46 C28 66 30 80 36 84 L64 84 C70 80 72 66 70 46 Z" fill="${m.hairColour}"/>`;
    case "afro": return `<circle cx="50" cy="41" r="27" fill="${m.hairColour}"/>`;
    case "braids": return `<rect x="28" y="44" width="8" height="38" rx="4" fill="${m.hairColour}"/><rect x="64" y="44" width="8" height="38" rx="4" fill="${m.hairColour}"/>`;
    case "pony": return `<path d="M64 34 C80 36 82 56 74 66 C76 54 72 44 64 42 Z" fill="${m.hairColour}"/>`;
    default: return "";
  }
}
function frontHair(m: Mover) {
  const c = m.hairColour;
  switch (m.hair) {
    case "short": return `<path d="M33 45 C32 27 44 22 51 22 C62 22 69 29 67 45 C64 37 58 33 50 33 C42 33 36 37 33 45 Z" fill="${c}"/>`;
    case "buzz": return `<path d="M34 41 C34 29 42 25 50 25 C58 25 66 29 66 41 C61 34 56 32 50 32 C44 32 39 34 34 41 Z" fill="${c}" opacity=".9"/>`;
    case "long": return `<path d="M32 47 C30 27 43 21 51 21 C63 21 71 29 68 47 C65 36 59 31 52 31 C46 34 39 38 32 47 Z" fill="${c}"/>`;
    case "bun": return `<circle cx="50" cy="20" r="8" fill="${c}"/><path d="M33 43 C33 28 43 24 50 24 C57 24 67 28 67 43 C62 35 56 32 50 32 C44 32 38 35 33 43 Z" fill="${c}"/>`;
    case "pony": return `<path d="M33 44 C32 28 43 23 51 23 C61 23 68 29 67 44 C63 36 57 32 50 32 C43 32 37 36 33 44 Z" fill="${c}"/>`;
    case "afro": return `<path d="M31 42 C34 30 42 27 50 27 C58 27 66 30 69 42 C63 36 57 34 50 34 C43 34 37 36 31 42 Z" fill="${c}"/>`;
    case "braids": return `<path d="M33 46 C32 28 43 23 50 23 C58 23 68 28 67 46 C64 36 57 32 50 32 C43 32 36 36 33 46 Z" fill="${c}"/><path d="M50 23 L50 33" stroke="${darker(c, 0.7)}" stroke-width="1.5"/>`;
    case "curly": return `<g fill="${c}"><circle cx="38" cy="33" r="7"/><circle cx="47" cy="27" r="7.5"/><circle cx="57" cy="28" r="7"/><circle cx="64" cy="35" r="6.5"/><circle cx="34" cy="41" r="5"/><circle cx="66" cy="42" r="5"/></g>`;
    default: return "";
  }
}
function head(m: Mover) {
  const shade = darker(m.skin, 0.88);
  return (
    `<rect x="44" y="60" width="12" height="14" rx="5" fill="${shade}"/>` +
    `<circle cx="33.5" cy="49" r="4" fill="${shade}"/><circle cx="66.5" cy="49" r="4" fill="${shade}"/>` +
    `<ellipse cx="50" cy="47" rx="16.5" ry="18.5" fill="${m.skin}"/>` +
    `<ellipse cx="43.5" cy="48" rx="2.1" ry="2.6" fill="${INK}"/><ellipse cx="56.5" cy="48" rx="2.1" ry="2.6" fill="${INK}"/>` +
    `<circle cx="40" cy="54" r="2.6" fill="#E0177A" opacity=".18"/><circle cx="60" cy="54" r="2.6" fill="#E0177A" opacity=".18"/>` +
    `<path d="M44.5 55.5 Q50 60.5 55.5 55.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
  );
}
function body(m: Mover) {
  return `<path d="M17 100 C17 82 31 73 50 73 C69 73 83 82 83 100 Z" fill="${m.top}"/><path d="M42 73 Q50 80 58 73" fill="none" stroke="${darker(m.top, 0.75)}" stroke-width="2"/>`;
}
function kit(m: Mover) {
  const k = m.kitColour;
  switch (m.kit) {
    case "band": return `<rect x="33" y="33" width="34" height="6" rx="3" fill="${k}"/>`;
    case "bandana": return `<path d="M33 37 C40 31 60 31 67 37 L67 41 C60 36 40 36 33 41 Z" fill="${k}"/><path d="M67 38 L74 44 L70 46 Z" fill="${k}"/>`;
    case "cap": return `<path d="M32 40 C32 26 42 22 50 22 C60 22 68 27 68 40 Z" fill="${k}"/><path d="M50 37 C60 36 74 37 78 41 C70 42 58 41 50 41 Z" fill="${darker(k, 0.8)}"/><circle cx="50" cy="23" r="2" fill="${darker(k, 0.7)}"/>`;
    case "swim": return `<path d="M33 46 C31 27 43 22 50 22 C58 22 70 27 67 46 C63 38 57 36 50 36 C43 36 37 38 33 46 Z" fill="${k}"/><g fill="#BDEBFA" stroke="${INK}" stroke-width="1.6"><rect x="37.5" y="36" width="10" height="7" rx="3.5"/><rect x="52.5" y="36" width="10" height="7" rx="3.5"/></g><path d="M47.5 39.5 L52.5 39.5" stroke="${INK}" stroke-width="1.6"/>`;
    case "helmet": return `<path d="M31 42 C31 25 43 19 51 20 C63 21 70 29 69 42 Z" fill="${k}"/><g stroke="${darker(k, 0.7)}" stroke-width="2"><path d="M42 23 L40 33"/><path d="M50 21 L50 32"/><path d="M58 22 L60 33"/></g><path d="M31 42 L69 42" stroke="${INK}" stroke-width="2"/>`;
    case "gloves": return `<g fill="${k}" stroke="${darker(k, 0.7)}" stroke-width="1.5"><rect x="17" y="80" width="18" height="20" rx="8"/><rect x="65" y="80" width="18" height="20" rx="8"/></g><rect x="33" y="33" width="34" height="5" rx="2.5" fill="${k}"/>`;
    case "medal": return `<path d="M40 73 L50 88 L60 73" fill="none" stroke="${k}" stroke-width="4"/><circle cx="50" cy="91" r="6.5" fill="#FFB703" stroke="#C98A00" stroke-width="1.5"/><path d="M50 87.5 L51.2 90 L54 90.3 L52 92.2 L52.5 95 L50 93.6 L47.5 95 L48 92.2 L46 90.3 L48.8 90 Z" fill="#FFF3C4"/>`;
    case "whistle": return `<path d="M42 74 Q50 88 58 74" fill="none" stroke="${k}" stroke-width="2.2"/><rect x="46" y="86" width="10" height="6" rx="3" fill="#C9CCD6" stroke="${INK}" stroke-width="1.2"/>`;
    case "jersey": return `<text x="50" y="96" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="${k}">${m.extra ?? "7"}</text>`;
    case "ball": return `<circle cx="78" cy="84" r="12" fill="#FFFFFF" stroke="${INK}" stroke-width="1.6"/><path d="M78 78 L83 81.5 L81 87.5 L75 87.5 L73 81.5 Z" fill="${INK}"/>`;
    case "racket": return `<ellipse cx="80" cy="70" rx="9" ry="11" fill="none" stroke="${k}" stroke-width="3"/><path d="M75 78 L70 92" stroke="${darker(k, 0.6)}" stroke-width="4" stroke-linecap="round"/><g stroke="${k}" stroke-width=".8" opacity=".7"><path d="M74 66 L86 66 M73 70 L87 70 M74 74 L86 74 M80 59 L80 81 M76 60 L76 80 M84 60 L84 80"/></g><circle cx="20" cy="22" r="6" fill="#DFFF4F" stroke="#9DB52B" stroke-width="1"/>`;
    case "wrap": return `<path d="M33 40 C33 25 43 20 50 20 C58 20 67 25 67 40 C62 34 57 32 50 32 C43 32 38 34 33 40 Z" fill="${k}"/><circle cx="50" cy="19" r="6" fill="${darker(k, 0.85)}"/>`;
    default: return "";
  }
}

function mover(m: Mover) {
  return svg(m.bg, `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${backHair(m)}${body(m)}${head(m)}${frontHair(m)}${kit(m)}`);
}

const MOVERS: Array<[string, string, Mover]> = [
  ["@run1", "Runner with a headband", { skin: SKIN.b, hair: "pony", hairColour: "#3B2417", top: "#E0177A", kit: "band", kitColour: "#4CC9F0", bg: "#2E2A3B" }],
  ["@run2", "Runner with a cap", { skin: SKIN.e, hair: "short", hairColour: "#1B1210", top: "#4CC9F0", kit: "cap", kitColour: "#E0177A", bg: "#2E2A3B" }],
  ["@swim1", "Swimmer with goggles", { skin: SKIN.c, hair: "none", hairColour: "#000", top: "#1B86B0", kit: "swim", kitColour: "#FFB703", bg: "#4CC9F0" }],
  ["@swim2", "Swimmer in a pink cap", { skin: SKIN.f, hair: "none", hairColour: "#000", top: "#211E2B", kit: "swim", kitColour: "#E0177A", bg: "#BDEBFA" }],
  ["@yoga1", "Yoga lover", { skin: SKIN.a, hair: "bun", hairColour: "#C2763C", top: "#3FD08F", kit: "none", kitColour: "#000", bg: "#DCF4FC" }],
  ["@yoga2", "Yoga lover with a wrap", { skin: SKIN.d, hair: "none", hairColour: "#000", top: "#FFB703", kit: "wrap", kitColour: "#7209B7", bg: "#FCE0EE" }],
  ["@danc1", "Dancer with curls", { skin: SKIN.c, hair: "curly", hairColour: "#2A1B12", top: "#7209B7", kit: "none", kitColour: "#000", bg: "#FFB703" }],
  ["@danc2", "Dancer with braids", { skin: SKIN.f, hair: "braids", hairColour: "#141010", top: "#E0177A", kit: "bandana", kitColour: "#FFB703", bg: "#2E2A3B" }],
  ["@foot1", "Footballer", { skin: SKIN.b, hair: "short", hairColour: "#E2B04A", top: "#3FD08F", kit: "ball", kitColour: "#15131C", bg: "#2E2A3B" }],
  ["@foot2", "Footballer number 9", { skin: SKIN.e, hair: "buzz", hairColour: "#1B1210", top: "#E0177A", kit: "jersey", kitColour: "#FFFFFF", bg: "#3FD08F", extra: "9" }],
  ["@hoop1", "Basketballer number 23", { skin: SKIN.f, hair: "afro", hairColour: "#1A1311", top: "#FB8500", kit: "jersey", kitColour: "#15131C", bg: "#211E2B", extra: "23" }],
  ["@ten1", "Tennis player", { skin: SKIN.a, hair: "pony", hairColour: "#7A4A26", top: "#FFFFFF", kit: "racket", kitColour: "#E0177A", bg: "#3FD08F" }],
  ["@box1", "Boxer", { skin: SKIN.d, hair: "buzz", hairColour: "#221611", top: "#211E2B", kit: "gloves", kitColour: "#E0177A", bg: "#FFB703" }],
  ["@bike1", "Cyclist", { skin: SKIN.b, hair: "none", hairColour: "#000", top: "#FFB703", kit: "helmet", kitColour: "#4CC9F0", bg: "#7209B7" }],
  ["@coach1", "Coach with a whistle", { skin: SKIN.c, hair: "short", hairColour: "#9A9AA6", top: "#1B86B0", kit: "whistle", kitColour: "#E0177A", bg: "#FCE0EE" }],
  ["@champ1", "Champion with a medal", { skin: SKIN.e, hair: "long", hairColour: "#1B1210", top: "#E0177A", kit: "medal", kitColour: "#4CC9F0", bg: "#2E2A3B" }],
  ["@champ2", "Champion with a gold medal", { skin: SKIN.a, hair: "short", hairColour: "#C9862E", top: "#4CC9F0", kit: "medal", kitColour: "#E0177A", bg: "#FFB703" }],
  ["@gym1", "Gymnast with a bun", { skin: SKIN.d, hair: "bun", hairColour: "#1E1410", top: "#E0177A", kit: "none", kitColour: "#000", bg: "#4CC9F0" }],
  ["@lift1", "Strong lifter", { skin: SKIN.c, hair: "buzz", hairColour: "#3B2417", top: "#15131C", kit: "band", kitColour: "#FFB703", bg: "#E0177A" }],
  ["@hike1", "Hiker with a cap", { skin: SKIN.a, hair: "long", hairColour: "#E2B04A", top: "#3FD08F", kit: "cap", kitColour: "#FB8500", bg: "#211E2B" }],
  ["@skate1", "Skater with a helmet", { skin: SKIN.f, hair: "none", hairColour: "#000", top: "#7209B7", kit: "helmet", kitColour: "#E0177A", bg: "#3FD08F" }],
  ["@net1", "Netballer", { skin: SKIN.b, hair: "pony", hairColour: "#1B1210", top: "#4CC9F0", kit: "jersey", kitColour: "#15131C", bg: "#FCE0EE", extra: "GA" }],
  ["@surf1", "Surfer", { skin: SKIN.c, hair: "long", hairColour: "#E8C170", top: "#1B86B0", kit: "none", kitColour: "#000", bg: "#FFB703" }],
  ["@martl1", "Martial artist", { skin: SKIN.a, hair: "short", hairColour: "#141010", top: "#FFFFFF", kit: "bandana", kitColour: "#E0177A", bg: "#2E2A3B" }],
];

/* ------------------------------------------------------------- Animal athletes ------------------------------------------------------------- */

function animalFace(o: { fur: string; inner: string; ears: string; snout?: string; nose?: string; extra?: string; kit?: string; bg: string; eyeRing?: string }) {
  return svg(
    o.bg,
    `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${o.ears}` +
      `<ellipse cx="50" cy="56" rx="27" ry="25" fill="${o.fur}"/>` +
      (o.eyeRing ?? "") +
      `<ellipse cx="41" cy="52" rx="2.6" ry="3.2" fill="${INK}"/><ellipse cx="59" cy="52" rx="2.6" ry="3.2" fill="${INK}"/>` +
      `<ellipse cx="50" cy="65" rx="11" ry="8" fill="${o.snout ?? o.inner}"/>` +
      `<ellipse cx="50" cy="61.5" rx="3.6" ry="2.6" fill="${o.nose ?? INK}"/>` +
      `<path d="M45 67 Q50 71 55 67" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      (o.extra ?? "") +
      (o.kit ?? ""),
  );
}
const band = (c: string, y = 37) => `<rect x="25" y="${y}" width="50" height="6" rx="3" fill="${c}"/>`;

const ANIMALS: AvatarDef[] = [
  { id: "@roo", name: "Kangaroo boxer", group: "animals", svg: animalFace({ fur: "#C98B52", inner: "#E8C39B", bg: "#E0177A", ears: `<path d="M30 40 L24 12 L40 32 Z" fill="#C98B52"/><path d="M70 40 L76 12 L60 32 Z" fill="#C98B52"/>`, kit: `<g fill="#4CC9F0" stroke="#1B86B0" stroke-width="1.5"><circle cx="20" cy="84" r="10"/><circle cx="80" cy="84" r="10"/></g>` }) },
  { id: "@koala", name: "Koala doing yoga", group: "animals", svg: animalFace({ fur: "#9CA3AF", inner: "#D6DAE1", snout: "#D6DAE1", nose: "#3B3F4A", bg: "#3FD08F", ears: `<circle cx="25" cy="38" r="13" fill="#9CA3AF"/><circle cx="75" cy="38" r="13" fill="#9CA3AF"/><circle cx="25" cy="38" r="7" fill="#F2D5DC"/><circle cx="75" cy="38" r="7" fill="#F2D5DC"/>`, kit: band("#FFB703", 34) }) },
  { id: "@fox", name: "Fox runner", group: "animals", svg: animalFace({ fur: "#FB8500", inner: "#FFF1E0", bg: "#211E2B", ears: `<path d="M28 42 L30 16 L46 34 Z" fill="#FB8500"/><path d="M72 42 L70 16 L54 34 Z" fill="#FB8500"/><path d="M32 36 L33 22 L42 33 Z" fill="#15131C" opacity=".35"/><path d="M68 36 L67 22 L58 33 Z" fill="#15131C" opacity=".35"/>`, kit: band("#E0177A") }) },
  { id: "@panda", name: "Panda lifter", group: "animals", svg: animalFace({ fur: "#FFFFFF", inner: "#F1F1F4", bg: "#4CC9F0", ears: `<circle cx="28" cy="36" r="10" fill="${INK}"/><circle cx="72" cy="36" r="10" fill="${INK}"/>`, eyeRing: `<ellipse cx="41" cy="52" rx="7" ry="8" fill="${INK}" transform="rotate(-20 41 52)"/><ellipse cx="59" cy="52" rx="7" ry="8" fill="${INK}" transform="rotate(20 59 52)"/><circle cx="41" cy="51" r="2.6" fill="#FFF"/><circle cx="59" cy="51" r="2.6" fill="#FFF"/>`, kit: band("#E0177A", 33) }) },
  { id: "@frog", name: "Frog swimmer", group: "animals", svg: animalFace({ fur: "#3FD08F", inner: "#BFF0D6", snout: "#BFF0D6", nose: "#1E7F55", bg: "#1B86B0", ears: `<circle cx="34" cy="36" r="11" fill="#3FD08F"/><circle cx="66" cy="36" r="11" fill="#3FD08F"/>`, kit: `<g fill="#BDEBFA" stroke="${INK}" stroke-width="1.6"><circle cx="34" cy="36" r="7"/><circle cx="66" cy="36" r="7"/></g><path d="M41 36 L59 36" stroke="${INK}" stroke-width="1.6"/>` }) },
  { id: "@bunny", name: "Bunny sprinter", group: "animals", svg: animalFace({ fur: "#F4F2F8", inner: "#FCE0EE", snout: "#FFFFFF", nose: "#E0177A", bg: "#7209B7", ears: `<rect x="31" y="6" width="12" height="38" rx="6" fill="#F4F2F8"/><rect x="57" y="6" width="12" height="38" rx="6" fill="#F4F2F8"/><rect x="34" y="11" width="6" height="28" rx="3" fill="#FCE0EE"/><rect x="60" y="11" width="6" height="28" rx="3" fill="#FCE0EE"/>`, kit: band("#4CC9F0") }) },
  { id: "@tiger", name: "Tiger footballer", group: "animals", svg: animalFace({ fur: "#FFB703", inner: "#FFF3D6", bg: "#2E2A3B", ears: `<circle cx="28" cy="36" r="9" fill="#FFB703"/><circle cx="72" cy="36" r="9" fill="#FFB703"/>`, extra: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round"><path d="M50 32 L50 40"/><path d="M42 34 L44 40"/><path d="M58 34 L56 40"/><path d="M24 54 L31 55"/><path d="M76 54 L69 55"/></g>`, kit: `<circle cx="80" cy="84" r="11" fill="#FFF" stroke="${INK}" stroke-width="1.6"/><path d="M80 78.5 L84.5 81.5 L83 86.5 L77 86.5 L75.5 81.5 Z" fill="${INK}"/>` }) },
  { id: "@pengu", name: "Penguin skater", group: "animals", svg: animalFace({ fur: "#2E2A3B", inner: "#FFFFFF", snout: "#F4F2F8", nose: "#FFB703", bg: "#BDEBFA", ears: "", eyeRing: `<ellipse cx="50" cy="58" rx="19" ry="18" fill="#F4F2F8"/>`, kit: `<path d="M27 46 C27 30 38 26 50 26 C62 26 73 30 73 46 Z" fill="#E0177A"/><circle cx="50" cy="25" r="4" fill="#FFFFFF"/>` }) },
];

/* ------------------------------------------------------------------ Gear ------------------------------------------------------------------- */

const tile = (bg: string, body: string) => svg(bg, `<circle cx="50" cy="50" r="38" fill="#FFFFFF" opacity=".12"/>${body}`);
const GEAR: AvatarDef[] = [
  { id: "@dumb", name: "Dumbbell", group: "gear", svg: tile("#E0177A", `<g fill="${INK}"><rect x="18" y="36" width="10" height="28" rx="3"/><rect x="72" y="36" width="10" height="28" rx="3"/><rect x="28" y="40" width="7" height="20" rx="2"/><rect x="65" y="40" width="7" height="20" rx="2"/></g><rect x="35" y="47" width="30" height="6" rx="3" fill="#F4F2F8"/>`) },
  { id: "@kettl", name: "Kettlebell", group: "gear", svg: tile("#4CC9F0", `<path d="M38 40 C36 22 64 22 62 40" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="58" r="21" fill="${INK}"/><text x="50" y="64" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="13" fill="#4CC9F0">8kg</text>`) },
  { id: "@shoe", name: "Running shoe", group: "gear", svg: tile("#FFB703", `<path d="M16 66 C16 54 22 44 30 42 L42 52 C52 56 70 56 82 62 C86 64 86 72 82 72 L20 72 C17 72 16 70 16 66 Z" fill="#E0177A"/><rect x="16" y="70" width="70" height="7" rx="3.5" fill="#F4F2F8" stroke="${INK}" stroke-width="1.5"/><g stroke="#F4F2F8" stroke-width="2.5" stroke-linecap="round"><path d="M36 50 L42 46"/><path d="M41 54 L47 50"/><path d="M46 57 L52 53"/></g>`) },
  { id: "@watch", name: "Stopwatch", group: "gear", svg: tile("#3FD08F", `<rect x="45" y="16" width="10" height="8" rx="2" fill="${INK}"/><circle cx="50" cy="55" r="27" fill="#F4F2F8" stroke="${INK}" stroke-width="5"/><path d="M50 55 L50 38" stroke="#E0177A" stroke-width="4" stroke-linecap="round"/><path d="M50 55 L62 61" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="55" r="3" fill="${INK}"/>`) },
  { id: "@medal", name: "Gold medal", group: "gear", svg: tile("#7209B7", `<path d="M34 14 L46 46 L54 46 L66 14 L56 14 L50 34 L44 14 Z" fill="#E0177A"/><circle cx="50" cy="62" r="20" fill="#FFB703" stroke="#C98A00" stroke-width="3"/><path d="M50 50 L53.5 57.5 L61.5 58.3 L55.5 63.6 L57.2 71.5 L50 67.5 L42.8 71.5 L44.5 63.6 L38.5 58.3 L46.5 57.5 Z" fill="#FFF3C4"/>`) },
  { id: "@troph", name: "Trophy", group: "gear", svg: tile("#2E2A3B", `<path d="M33 22 L67 22 L64 48 C62 58 56 62 50 62 C44 62 38 58 36 48 Z" fill="#FFB703"/><path d="M33 28 C20 28 22 46 36 46" fill="none" stroke="#FFB703" stroke-width="5"/><path d="M67 28 C80 28 78 46 64 46" fill="none" stroke="#FFB703" stroke-width="5"/><rect x="45" y="62" width="10" height="12" fill="#C98A00"/><rect x="34" y="74" width="32" height="8" rx="2" fill="#E0177A"/>`) },
  { id: "@bottl", name: "Water bottle", group: "gear", svg: tile("#E0177A", `<rect x="42" y="14" width="16" height="10" rx="3" fill="${INK}"/><rect x="34" y="24" width="32" height="62" rx="10" fill="#4CC9F0"/><rect x="34" y="44" width="32" height="18" fill="#F4F2F8"/><path d="M40 70 Q44 66 48 70 T56 70" fill="none" stroke="#F4F2F8" stroke-width="2.5"/>`) },
  { id: "@rope", name: "Skipping rope", group: "gear", svg: tile("#4CC9F0", `<path d="M26 70 C26 18 74 18 74 70" fill="none" stroke="#E0177A" stroke-width="4"/><rect x="20" y="66" width="12" height="22" rx="5" fill="${INK}"/><rect x="68" y="66" width="12" height="22" rx="5" fill="${INK}"/>`) },
  { id: "@socc", name: "Soccer ball", group: "gear", svg: tile("#3FD08F", `<circle cx="50" cy="50" r="28" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><path d="M50 38 L61 46 L57 59 L43 59 L39 46 Z" fill="${INK}"/><g stroke="${INK}" stroke-width="2.5"><path d="M50 38 L50 23"/><path d="M61 46 L75 41"/><path d="M57 59 L66 71"/><path d="M43 59 L34 71"/><path d="M39 46 L25 41"/></g>`) },
  { id: "@bball", name: "Basketball", group: "gear", svg: tile("#211E2B", `<circle cx="50" cy="50" r="28" fill="#FB8500" stroke="${INK}" stroke-width="2.5"/><g fill="none" stroke="${INK}" stroke-width="2.5"><path d="M22 50 L78 50"/><path d="M50 22 L50 78"/><path d="M30 30 C40 40 40 60 30 70"/><path d="M70 30 C60 40 60 60 70 70"/></g>`) },
  { id: "@bike", name: "Bike", group: "gear", svg: tile("#FFB703", `<g fill="none" stroke="${INK}" stroke-width="4"><circle cx="28" cy="62" r="14"/><circle cx="72" cy="62" r="14"/></g><path d="M28 62 L42 40 L62 40 L72 62 M42 40 L52 62 L62 40 M56 32 L66 32 M42 40 L38 32" fill="none" stroke="#E0177A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "@mat", name: "Yoga mat", group: "gear", svg: tile("#FCE0EE", `<rect x="18" y="56" width="64" height="16" rx="3" fill="#7209B7"/><path d="M82 64 C92 64 92 40 76 40 L30 40 C20 40 18 50 26 54 L74 54 C80 54 82 60 82 64 Z" fill="#E0177A"/><circle cx="76" cy="50" r="6" fill="#7209B7"/>`) },
  { id: "@heart", name: "Heart", group: "gear", svg: tile("#2E2A3B", `<path d="M50 78 C24 60 18 44 26 32 C33 22 46 24 50 34 C54 24 67 22 74 32 C82 44 76 60 50 78 Z" fill="#E0177A"/><path d="M22 52 L38 52 L44 42 L52 62 L58 50 L78 50" fill="none" stroke="#F4F2F8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`) },
  { id: "@flame", name: "Flame", group: "gear", svg: tile("#211E2B", `<path d="M50 14 C58 30 74 38 72 60 C70 76 60 84 50 84 C38 84 28 76 28 62 C28 50 36 44 38 34 C44 40 46 46 46 52 C52 44 54 30 50 14 Z" fill="#FB8500"/><path d="M50 50 C56 58 62 62 60 72 C58 80 54 82 50 82 C44 82 40 78 40 70 C40 62 46 60 50 50 Z" fill="#FFB703"/>`) },
  { id: "@bolt", name: "Lightning bolt", group: "gear", svg: tile("#7209B7", `<path d="M56 12 L26 56 L46 56 L40 88 L74 40 L54 40 Z" fill="#FFB703" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "@peak", name: "Mountain peak", group: "gear", svg: tile("#4CC9F0", `<path d="M10 82 L38 34 L54 58 L64 44 L90 82 Z" fill="#2E2A3B"/><path d="M38 34 L46 48 L40 46 L34 50 L30 47 Z" fill="#F4F2F8"/><path d="M64 44 L70 54 L62 52 Z" fill="#F4F2F8"/><path d="M64 44 L64 20 L78 25 L64 30" fill="#E0177A" stroke="${INK}" stroke-width="1.5"/>`) },
  { id: "@star", name: "Star", group: "gear", svg: tile("#E0177A", `<path d="M50 14 L60 38 L86 40 L66 57 L72 82 L50 69 L28 82 L34 57 L14 40 L40 38 Z" fill="#FFB703" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`) },
  { id: "@whist", name: "Whistle", group: "gear", svg: tile("#3FD08F", `<path d="M22 46 C22 36 30 30 40 30 L74 30 L74 44 L60 44 C62 48 62 54 60 58 C56 68 44 72 34 68 C26 64 22 56 22 46 Z" fill="#C9CCD6" stroke="${INK}" stroke-width="3"/><circle cx="40" cy="52" r="7" fill="${INK}"/><path d="M74 30 L80 22" stroke="#E0177A" stroke-width="3"/>`) },
];

/* ------------------------------------------------------------- Animated (web) -------------------------------------------------------------- */

const ANIMATED: AvatarDef[] = [
  { id: "@abounce", name: "Bouncing basketball", group: "animated", svg: svg("#211E2B", `<ellipse cx="50" cy="86" rx="18" ry="4" fill="#000" opacity=".35"><animate attributeName="rx" values="18;10;18" dur="1s" repeatCount="indefinite"/></ellipse><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -26;0 0" keyTimes="0;.5;1" keySplines=".3 0 .7 1;.3 0 .7 1" calcMode="spline" dur="1s" repeatCount="indefinite"/><circle cx="50" cy="62" r="20" fill="#FB8500" stroke="${INK}" stroke-width="2"/><g fill="none" stroke="${INK}" stroke-width="2"><path d="M30 62 L70 62"/><path d="M50 42 L50 82"/><path d="M36 48 C43 56 43 68 36 76"/><path d="M64 48 C57 56 57 68 64 76"/></g></g>`) },
  { id: "@aheart", name: "Beating heart", group: "animated", svg: svg("#2E2A3B", `<g transform="translate(50 50)"><g><animateTransform attributeName="transform" type="scale" values="1;1.14;1;1.08;1" dur="1.1s" repeatCount="indefinite"/><path d="M0 28 C-26 10 -32 -6 -24 -18 C-17 -28 -4 -26 0 -16 C4 -26 17 -28 24 -18 C32 -6 26 10 0 28 Z" fill="#E0177A"/></g></g>`) },
  { id: "@aflame", name: "Flickering flame", group: "animated", svg: svg("#2E2A3B", `<g transform="translate(50 84)"><g><animateTransform attributeName="transform" type="scale" values="1 1;0.96 1.06;1.03 0.97;1 1" dur="0.9s" repeatCount="indefinite"/><path d="M0 -70 C8 -54 24 -46 22 -24 C20 -8 10 0 0 0 C-12 0 -22 -8 -22 -22 C-22 -34 -14 -40 -12 -50 C-6 -44 -4 -38 -4 -32 C2 -40 4 -54 0 -70 Z" fill="#FB8500"/><path d="M0 -34 C6 -26 12 -22 10 -12 C8 -4 4 -2 0 -2 C-6 -2 -10 -6 -10 -14 C-10 -22 -4 -24 0 -34 Z" fill="#FFB703"/></g></g>`) },
  { id: "@awatch", name: "Ticking stopwatch", group: "animated", svg: svg("#3FD08F", `<rect x="45" y="14" width="10" height="8" rx="2" fill="${INK}"/><circle cx="50" cy="54" r="28" fill="#F4F2F8" stroke="${INK}" stroke-width="5"/><g><animateTransform attributeName="transform" type="rotate" from="0 50 54" to="360 50 54" dur="4s" repeatCount="indefinite"/><path d="M50 54 L50 34" stroke="#E0177A" stroke-width="4" stroke-linecap="round"/></g><circle cx="50" cy="54" r="3.5" fill="${INK}"/>`) },
  { id: "@awave", name: "Swimming waves", group: "animated", svg: svg("#4CC9F0", `<g fill="none" stroke="#F4F2F8" stroke-width="5" stroke-linecap="round"><path d="M-20 40 Q-10 32 0 40 T20 40 T40 40 T60 40 T80 40 T100 40 T120 40"><animateTransform attributeName="transform" type="translate" values="0 0;-20 0" dur="1.2s" repeatCount="indefinite"/></path><path d="M-20 60 Q-10 52 0 60 T20 60 T40 60 T60 60 T80 60 T100 60 T120 60" stroke="#1B86B0"><animateTransform attributeName="transform" type="translate" values="-20 0;0 0" dur="1.5s" repeatCount="indefinite"/></path><path d="M-20 80 Q-10 72 0 80 T20 80 T40 80 T60 80 T80 80 T100 80 T120 80"><animateTransform attributeName="transform" type="translate" values="0 0;-20 0" dur="1.8s" repeatCount="indefinite"/></path></g><circle cx="74" cy="22" r="9" fill="#FFB703"/>`) },
  { id: "@astar", name: "Spinning star", group: "animated", svg: svg("#7209B7", `<g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite"/><path d="M50 16 L59 39 L84 41 L65 57 L71 81 L50 68 L29 81 L35 57 L16 41 L41 39 Z" fill="#FFB703" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g><g fill="#F4F2F8"><circle cx="20" cy="22" r="2.5"><animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="82" cy="80" r="2.5"><animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite"/></circle></g>`) },
  { id: "@adance", name: "Dancing mover", group: "animated", svg: (() => {
    const m: Mover = { skin: SKIN.c, hair: "curly", hairColour: "#2A1B12", top: "#E0177A", kit: "none", kitColour: "#000", bg: "#FFB703" };
    return svg(m.bg, `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${body(m)}<g><animateTransform attributeName="transform" type="rotate" values="-8 50 72;8 50 72;-8 50 72" dur="1s" repeatCount="indefinite"/>${backHair(m)}${head(m)}${frontHair(m)}</g><g fill="${INK}"><path d="M14 30 l0 -14 l8 -2 l0 12" stroke="${INK}" stroke-width="2" fill="none"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></path><circle cx="12" cy="31" r="3"/><circle cx="20" cy="29" r="3"/></g>`);
  })() },
  { id: "@ajump", name: "Jumping runner", group: "animated", svg: (() => {
    const m: Mover = { skin: SKIN.e, hair: "pony", hairColour: "#1B1210", top: "#4CC9F0", kit: "band", kitColour: "#E0177A", bg: "#211E2B" };
    return svg(m.bg, `<ellipse cx="50" cy="97" rx="26" ry="4" fill="#000" opacity=".35"/><g><animateTransform attributeName="transform" type="translate" values="0 6;0 -6;0 6" keyTimes="0;.5;1" keySplines=".3 0 .7 1;.3 0 .7 1" calcMode="spline" dur="0.8s" repeatCount="indefinite"/>${backHair(m)}${body(m)}${head(m)}${frontHair(m)}${kit(m)}</g>`);
  })() },
];

export const AVATARS: AvatarDef[] = [
  ...MOVERS.map(([id, name, m]) => ({ id, name, group: "movers" as const, svg: mover(m) })),
  ...ANIMALS,
  ...GEAR,
  ...ANIMATED,
];
export const AVATAR_GROUPS: AvatarGroup[] = ["movers", "animals", "gear", "animated"];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/** The library picture for a stored avatar value, or undefined for an emoji avatar. */
export const avatarById = (value: string | undefined | null): AvatarDef | undefined => (value && value.startsWith("@") ? BY_ID.get(value) : undefined);

/** Same picture without animation (phone app, and people who ask their device for reduced motion). */
export const stillSvg = (s: string) => s.replace(/<animate(Transform)?\b[^>]*\/>/g, "").replace(/<animate(Transform)?\b[^>]*>[\s\S]*?<\/animate(Transform)?>/g, "");
