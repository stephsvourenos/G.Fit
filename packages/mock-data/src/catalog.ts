import type { AgeBand, CategoryId, Equipment, Instructor, Intensity, Profile, Workout } from "@app/domain";

/**
 * SAMPLE DATA ONLY. All names are invented placeholders. The founder's
 * children are represented by fictional "Junior Coach" personas with emoji
 * avatars — no real names or photos.
 */
export const instructors: Instructor[] = [
  { id: "ins-ava", displayName: "Coach Ava", isMinor: false, bio: "Pilates and mobility coach who makes core work feel like play.", specialties: ["pilates", "mobility"], creatorId: "cr-ava", accent: "#8B5CF6" },
  { id: "ins-theo", displayName: "Coach Theo", isMinor: false, bio: "Former academy player. Footwork, speed and strength for all ages.", specialties: ["soccer", "strength"], creatorId: "cr-theo", accent: "#16A34A" },
  { id: "ins-rosa", displayName: "Coach Rosa", isMinor: false, bio: "Dance teacher who believes every kitchen is a dance floor.", specialties: ["dance", "move-and-play"], creatorId: "cr-rosa", accent: "#EC4899" },
  { id: "ins-pip", displayName: "Junior Coach Pip", isMinor: true, bio: "Teen footy fanatic sharing the drills that actually work.", specialties: ["soccer", "challenges"], creatorId: "cr-pip", accent: "#F97316" },
  { id: "ins-bee", displayName: "Junior Coach Bee", isMinor: true, bio: "Loves dance breaks, obstacle courses and silly warm-ups.", specialties: ["move-and-play", "dance"], creatorId: "cr-bee", accent: "#EAB308" },
  { id: "ins-kit", displayName: "Junior Coach Kit", isMinor: true, bio: "Our littlest coach — animal moves and giggles guaranteed.", specialties: ["move-and-play"], creatorId: "cr-kit", accent: "#06B6D4" },
];

type Seed = [
  title: string,
  instructorId: string,
  category: CategoryId,
  minutes: number,
  intensity: Intensity,
  equipment: Equipment[],
  ages: AgeBand[],
  emoji: string,
  gradient: [string, string],
  description: string,
];

const ALL: AgeBand[] = ["under-6", "6-8", "9-12", "13-15", "16-17", "adult"];
const KIDS6: AgeBand[] = ["under-6", "6-8"];
const NINEUP: AgeBand[] = ["9-12", "13-15", "16-17", "adult"];
const TEENUP: AgeBand[] = ["13-15", "16-17", "adult"];
const SIXUP: AgeBand[] = ["6-8", "9-12", "13-15", "16-17", "adult"];

const seeds: Seed[] = [
  ["Family Wake-Up Shake", "ins-rosa", "dance", 8, "moderate", ["none"], ALL, "🌅", ["#FF8A5B", "#FFD166"], "A joyful eight-minute groove the whole house can do in pyjamas."],
  ["Jungle Animal Moves", "ins-kit", "move-and-play", 6, "gentle", ["none"], KIDS6, "🦁", ["#06B6D4", "#A7F3D0"], "Stomp like an elephant, hop like a frog, stretch like a giraffe."],
  ["Wall Pilates: Core Basics", "ins-ava", "pilates", 20, "moderate", ["wall", "mat"], TEENUP, "🧱", ["#8B5CF6", "#C4B5FD"], "Use any clear wall for a low-impact core and posture session."],
  ["First Touch Footwork", "ins-pip", "soccer", 12, "moderate", ["ball"], SIXUP, "⚽", ["#F97316", "#FDBA74"], "Inside, outside, sole rolls — build quick feet in your hallway."],
  ["Speed Ladder Without a Ladder", "ins-theo", "soccer", 15, "energetic", ["none"], NINEUP, "⚡", ["#16A34A", "#86EFAC"], "Chalk or tape lines are all you need for fast, safe agility work."],
  ["Silly Warm-Up Party", "ins-bee", "move-and-play", 5, "gentle", ["none"], ["under-6", "6-8", "9-12"], "🎉", ["#EAB308", "#FEF08A"], "Five minutes of wiggles, jumps and laughs before school."],
  ["Bedtime Stretch & Breathe", "ins-ava", "mobility", 10, "gentle", ["mat"], ALL, "🌙", ["#1E3A8A", "#818CF8"], "Slow stretches and calm breathing to wind down together."],
  ["Strength Fundamentals: Squat School", "ins-theo", "strength", 18, "moderate", ["none", "chair"], TEENUP, "🏋️", ["#334155", "#94A3B8"], "Learn the squat properly with a chair as your coach."],
  ["Dance Break: Pop Party", "ins-rosa", "dance", 12, "energetic", ["none"], SIXUP, "🪩", ["#EC4899", "#F9A8D4"], "Big moves, simple steps — no dance experience needed."],
  ["Obstacle Course Builder", "ins-bee", "challenges", 15, "moderate", ["chair", "mat"], ["6-8", "9-12"], "🧗", ["#EAB308", "#FCA5A5"], "Turn cushions and chairs into a safe living-room course."],
  ["Juggling Challenge: Level 1", "ins-pip", "challenges", 10, "moderate", ["ball"], ["9-12", "13-15", "16-17", "adult"], "🏅", ["#F97316", "#FDE68A"], "Beat your own best — no leaderboards, just personal records."],
  ["Mobility for Desk Days", "ins-ava", "mobility", 12, "gentle", ["chair"], ["16-17", "adult"], "🪑", ["#0F766E", "#5EEAD4"], "Hips, shoulders and spine after a long day sitting."],
  ["Mini Movers: Weather Dance", "ins-kit", "move-and-play", 4, "gentle", ["none"], KIDS6, "🌦️", ["#38BDF8", "#E0F2FE"], "Be the sunshine, the rain and the wild windy weather."],
  ["Parent + Kid Partner Pilates", "ins-ava", "pilates", 15, "gentle", ["mat"], ["6-8", "9-12", "adult"], "🤝", ["#A855F7", "#FBCFE8"], "Do it together: balance, mirror moves and partner planks."],
  ["Shooting Technique at Home", "ins-theo", "soccer", 14, "moderate", ["ball"], NINEUP, "🥅", ["#15803D", "#BBF7D0"], "Plant foot, laces, follow-through — using a soft ball indoors."],
  ["Core Strength for Young Athletes", "ins-pip", "strength", 12, "moderate", ["mat"], ["13-15", "16-17"], "🛡️", ["#EA580C", "#FED7AA"], "Age-appropriate core work that supports sport and posture."],
  ["Freeze Dance", "ins-bee", "dance", 6, "moderate", ["none"], ["under-6", "6-8", "9-12"], "🧊", ["#FDE047", "#A5F3FC"], "Dance until the music stops — then freeze like a statue!"],
  ["Full Body Family Circuit", "ins-theo", "strength", 22, "energetic", ["none"], SIXUP, "🔁", ["#0F172A", "#F97316"], "Station-based circuit with easier and harder options for every age."],
  ["Wall Pilates: Legs & Glutes", "ins-ava", "pilates", 18, "moderate", ["wall"], ["16-17", "adult"], "🍑", ["#7C3AED", "#F0ABFC"], "A strong, steady lower-body session using the wall for support."],
  ["Hip-Hop Basics", "ins-rosa", "dance", 16, "energetic", ["none"], NINEUP, "🎧", ["#DB2777", "#818CF8"], "Bounce, rock and groove — foundation moves broken down slowly."],
  ["Balance Builders", "ins-kit", "move-and-play", 5, "gentle", ["none"], KIDS6, "🦩", ["#22D3EE", "#FBCFE8"], "Stand like a flamingo and walk the tightrope line."],
  ["30-Day Kick-Ups Challenge: Day 1", "ins-pip", "challenges", 8, "moderate", ["ball"], ["9-12", "13-15", "16-17", "adult"], "📅", ["#C2410C", "#FCD34D"], "Start the family kick-ups challenge — track your own progress."],
  ["Gentle Mobility Flow (Seated Option)", "ins-ava", "mobility", 14, "gentle", ["chair"], ALL, "♿", ["#047857", "#A7F3D0"], "Fully seated options throughout. Captioned and audio-described cues."],
  ["Superhero Training Camp", "ins-bee", "move-and-play", 10, "moderate", ["none"], ["6-8", "9-12"], "🦸", ["#F59E0B", "#93C5FD"], "Power poses, hero lunges and mission-based moves."],
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const workouts: Workout[] = seeds.map((s, i) => {
  const [title, instructorId, category, minutes, intensity, equipment, ages, emoji, [from, to], description] = s;
  const instructor = instructors.find((x) => x.id === instructorId)!;
  // A few items sit in earlier workflow states so the admin demo has work to do.
  const state = i === 21 ? "awaiting-review" : i === 23 ? "approved" : i === 22 ? "scheduled" : "published";
  const day = String(1 + ((i * 3) % 27)).padStart(2, "0");
  return {
    id: `wk-${slug(title)}`,
    title,
    description,
    instructorId,
    creatorId: instructor.creatorId,
    category,
    durationSec: minutes * 60,
    intensity,
    equipment,
    ageBands: ages,
    captions: i % 3 !== 2,
    accessibilityNotes: equipment.includes("chair") ? "Seated alternatives shown on screen." : undefined,
    state,
    publishedAt: state === "published" ? `2026-${i < 12 ? "09" : "10"}-${day}` : undefined,
    rights: {
      creatorLicenceSigned: true,
      musicCleared: i !== 23,
      safetyReviewed: i !== 21,
      guardianConsent: instructor.isMinor ? true : "not-applicable",
      territories: ["AU", "NZ"],
    },
    thumbnail: { from, to, emoji },
  } satisfies Workout;
});

export const demoHouseholdId = "hh-demo";

export const demoProfiles: Profile[] = [
  { id: "pr-sam", householdId: demoHouseholdId, nickname: "Sam", avatar: { emoji: "🦉", colour: "#2E6BFF" }, ageBand: "adult", interests: ["pilates", "mobility", "strength"], pinProtected: true },
  { id: "pr-jo", householdId: demoHouseholdId, nickname: "Jo", avatar: { emoji: "🐺", colour: "#0E1116" }, ageBand: "adult", interests: ["soccer", "strength"], pinProtected: true },
  { id: "pr-ollie", householdId: demoHouseholdId, nickname: "Ollie", avatar: { emoji: "🦊", colour: "#FF5A36" }, ageBand: "13-15", interests: ["soccer", "challenges", "strength"], pinProtected: false },
  { id: "pr-ruby", householdId: demoHouseholdId, nickname: "Ruby", avatar: { emoji: "🐬", colour: "#21C08B" }, ageBand: "9-12", interests: ["dance", "move-and-play"], pinProtected: false, maxIntensity: "moderate" },
  { id: "pr-leo", householdId: demoHouseholdId, nickname: "Leo", avatar: { emoji: "🐣", colour: "#FFC23D" }, ageBand: "under-6", interests: ["move-and-play"], pinProtected: false },
];

/** Demo parent PIN for the prototype ONLY. Real PINs are hashed server-side. */
export const DEMO_PIN = "1234";

export const programs = [
  { id: "pg-kickups", title: "30-Day Kick-Ups", blurb: "One short session a day. Beat your own best.", workoutIds: ["wk-30-day-kick-ups-challenge-day-1", "wk-juggling-challenge-level-1", "wk-first-touch-footwork"], emoji: "📅" },
  { id: "pg-wallpilates", title: "Wall Pilates in 2 Weeks", blurb: "Four sessions a week, building from basics.", workoutIds: ["wk-wall-pilates-core-basics", "wk-wall-pilates-legs-glutes", "wk-mobility-for-desk-days"], emoji: "🧱" },
  { id: "pg-mini", title: "Mini Movers Week", blurb: "Five playful mornings for little ones.", workoutIds: ["wk-jungle-animal-moves", "wk-mini-movers-weather-dance", "wk-balance-builders", "wk-silly-warm-up-party"], emoji: "🐣" },
];

/** Demo viewing history for the profile pages (seconds into each workout). */
export const demoProgress: Record<string, Record<string, number>> = {
  "pr-ollie": { "wk-first-touch-footwork": 420, "wk-speed-ladder-without-a-ladder": 300 },
  "pr-ruby": { "wk-dance-break-pop-party": 380 },
  "pr-sam": { "wk-wall-pilates-core-basics": 610 },
  "pr-leo": {},
  "pr-jo": { "wk-strength-fundamentals-squat-school": 200 },
};
