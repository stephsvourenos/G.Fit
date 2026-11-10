// GENERATED from packages/domain/src by scripts/bundle-deno.mjs — do not edit by hand.
// deno-lint-ignore-file

// src/money.ts
function assertMinor(value, label = "amount") {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer number of minor units, got ${value}`);
  }
  return value;
}
function money(amountMinor, currency = "AUD") {
  return { amountMinor: assertMinor(amountMinor), currency };
}
function pct(percent) {
  const bps = Math.round(percent * 100);
  if (bps < 0 || bps > 1e4) throw new Error(`rate out of range: ${percent}%`);
  return bps;
}
function applyRate(amountMinor, rateBps) {
  assertMinor(amountMinor);
  const sign = amountMinor < 0 ? -1 : 1;
  const abs = Math.abs(amountMinor);
  const TEN_K = BigInt(1e4);
  const ONE = BigInt(1);
  const TWO = BigInt(2);
  const scaled = BigInt(abs) * BigInt(rateBps);
  const quotient = scaled / TEN_K;
  const remainder = scaled % TEN_K;
  const rounded = remainder * TWO >= TEN_K ? quotient + ONE : quotient;
  return sign * Number(rounded);
}
function allocateByWeight(totalMinor, shares) {
  assertMinor(totalMinor, "total");
  const result = /* @__PURE__ */ new Map();
  const positive = shares.filter((s) => s.weight > 0);
  if (positive.length === 0) return result;
  for (const s of shares) {
    if (s.weight < 0 || !Number.isFinite(s.weight)) throw new Error(`invalid weight for ${s.key}`);
  }
  const SCALE = 1e6;
  const intWeights = positive.map((s) => ({ key: s.key, w: BigInt(Math.round(s.weight * SCALE)) }));
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const totalWeight = intWeights.reduce((acc, s) => acc + s.w, ZERO);
  if (totalWeight === ZERO) return result;
  const sign = totalMinor < 0 ? -ONE : ONE;
  const absTotal = BigInt(Math.abs(totalMinor));
  let assigned = ZERO;
  const parts = intWeights.map((s) => {
    const exact = absTotal * s.w;
    const floor = exact / totalWeight;
    const remainder = exact % totalWeight;
    assigned += floor;
    return { key: s.key, floor, remainder };
  });
  let leftover = absTotal - assigned;
  const byRemainder = [...parts].sort(
    (a, b) => a.remainder === b.remainder ? a.key < b.key ? -1 : 1 : a.remainder > b.remainder ? -1 : 1
  );
  for (const p of byRemainder) {
    if (leftover === ZERO) break;
    p.floor += ONE;
    leftover -= ONE;
  }
  for (const p of parts) result.set(p.key, Number(sign * p.floor));
  return result;
}
function sumMinor(values) {
  let total = 0;
  for (const v of values) total += assertMinor(v);
  return assertMinor(total, "sum");
}
var SYMBOLS = {
  AUD: "A$",
  NZD: "NZ$",
  USD: "US$",
  GBP: "\xA3",
  EUR: "\u20AC",
  CAD: "C$"
};
function formatMoney(amountMinor, currency = "AUD") {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const dollars = Math.floor(abs / 100).toLocaleString("en-AU");
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${SYMBOLS[currency]}${dollars}.${cents}`;
}

// src/catalog.ts
var AGE_BANDS = ["under-6", "6-8", "9-12", "13-15", "16-17", "adult"];
var AGE_BAND_LABEL = {
  "under-6": "Under 6",
  "6-8": "6\u20138",
  "9-12": "9\u201312",
  "13-15": "13\u201315",
  "16-17": "16\u201317",
  adult: "Adult"
};
var BAND_FROM = { "under-6": 0, "6-8": 6, "9-12": 9, "13-15": 13, "16-17": 16, adult: 18 };
var BAND_TO = { "under-6": 5, "6-8": 8, "9-12": 12, "13-15": 15, "16-17": 17, adult: 99 };
function suitabilityLabel(bands) {
  const idx = [...new Set(bands)].map((b) => AGE_BANDS.indexOf(b)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idx.length === 0) return "Suitable for all ages";
  if (idx.length === AGE_BANDS.length) return "Suitable for all ages";
  const contiguous = idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
  if (!contiguous) return `Suitable for: ${idx.map((i) => AGE_BAND_LABEL[AGE_BANDS[i]]).join(", ")}`;
  const first = AGE_BANDS[idx[0]], last = AGE_BANDS[idx[idx.length - 1]];
  if (first === "adult") return "Suitable for adults";
  if (last === "adult") return first === "under-6" ? "Suitable for all ages" : `Suitable for ages ${BAND_FROM[first]} and up`;
  if (first === "under-6") return `Suitable for under ${BAND_TO[last] + 1}s`;
  return `Suitable for ages ${BAND_FROM[first]}\u2013${BAND_TO[last]}`;
}
function isChildBand(band2) {
  return band2 !== "adult";
}
var CATEGORIES = [
  "soccer",
  "pilates",
  "move-and-play",
  "dance",
  "strength",
  "mobility",
  "challenges"
];
var CATEGORY_LABEL = {
  soccer: "Soccer",
  pilates: "Pilates",
  "move-and-play": "Move & Play",
  dance: "Dance",
  strength: "Strength",
  mobility: "Mobility",
  challenges: "Challenges"
};
var CONTENT_STATES = [
  "draft",
  "uploaded",
  "awaiting-review",
  "approved",
  "scheduled",
  "published",
  "archived"
];
function canPublish(w, instructor) {
  const problems = [];
  if (!w.rights.creatorLicenceSigned) problems.push("Creator licence not signed");
  if (!w.rights.musicCleared) problems.push("Music rights not cleared");
  if (!w.rights.safetyReviewed) problems.push("Safety review not completed");
  if (instructor?.isMinor && w.rights.guardianConsent !== true) {
    problems.push("Guardian consent missing for a minor instructor");
  }
  if (w.rights.territories.length === 0) problems.push("No licensed territories");
  if (w.ageBands.length === 0) problems.push("No age eligibility set");
  if (!w.captions) problems.push("No captions yet (they\u2019re made automatically after the video uploads)");
  if (w.state !== "approved" && w.state !== "scheduled") {
    problems.push(`Must be approved before publishing (currently ${w.state})`);
  }
  return { ok: problems.length === 0, problems };
}
var INTENSITY_ORDER = ["gentle", "moderate", "energetic"];
function isAllowedForProfile(w, p) {
  if (w.state !== "published") return false;
  if (!w.ageBands.includes(p.ageBand)) return false;
  if (p.maxIntensity && INTENSITY_ORDER.indexOf(w.intensity) > INTENSITY_ORDER.indexOf(p.maxIntensity)) {
    return false;
  }
  return true;
}
function filterWorkouts(list, f) {
  const q = f.query?.trim().toLowerCase();
  return list.filter((w) => {
    if (f.ageBand && !w.ageBands.includes(f.ageBand)) return false;
    if (f.category && w.category !== f.category) return false;
    if (f.intensity && w.intensity !== f.intensity) return false;
    if (f.maxDurationSec && w.durationSec > f.maxDurationSec) return false;
    if (f.equipment && !w.equipment.includes(f.equipment)) return false;
    if (f.instructorId && w.instructorId !== f.instructorId) return false;
    if (f.captionsOnly && !w.captions) return false;
    if (q && !`${w.title} ${w.description} ${w.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function formatDuration(sec) {
  const m = Math.round(sec / 60);
  return m < 1 ? `${sec}s` : `${m} min`;
}

// src/entitlement.ts
function hasStreamingAccess(e, now) {
  if (!e) return false;
  const end = new Date(e.currentPeriodEnd).getTime();
  const graceEnd = end + e.graceDays * 864e5;
  switch (e.status) {
    case "active":
    case "trialing":
      return now.getTime() < graceEnd;
    case "past_due":
      return now.getTime() < graceEnd;
    case "canceled":
      return now.getTime() < end;
    default:
      return false;
  }
}
function decidePlayback(args) {
  const { entitlement, profile, workout, pinUnlocked, now } = args;
  if (!hasStreamingAccess(entitlement, now)) return { allowed: false, reason: "no-entitlement" };
  if (profile.pinProtected && !pinUnlocked) return { allowed: false, reason: "pin-required" };
  if (workout.state !== "published") return { allowed: false, reason: "not-published" };
  if (!isAllowedForProfile(workout, profile)) return { allowed: false, reason: "age-restricted" };
  return { allowed: true };
}

// src/receipts.ts
var DEFAULT_NET_RECEIPTS_POLICY = {
  version: "net-receipts-v1",
  excludeTax: true,
  deductProcessorFees: true,
  deductPlatformFees: true,
  deductDisputeFees: true,
  description: "Net receipts = amount the customer actually paid, minus GST/tax, minus payment-processor fees, minus any app-store commission. Refunds and chargebacks are deducted when they happen, as adjusting entries (earlier statements are never rewritten)."
};
function invoiceNetMinor(inv, policy) {
  let net = inv.grossPaidMinor - inv.taxMinor;
  if (policy.deductProcessorFees) net -= inv.processorFeeMinor;
  if (policy.deductPlatformFees) net -= inv.platformFeeMinor;
  return assertMinor(Math.max(0, net), "invoice net");
}
function refundNetMinor(r, policy) {
  let net = r.grossRefundMinor - r.taxRefundMinor - r.processorFeeReturnedMinor;
  if (policy.deductDisputeFees) net += r.disputeFeeMinor;
  return assertMinor(Math.max(0, net), "refund net");
}
function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = idx % 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function monthsBetween(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + bm - (ay * 12 + am);
}
function recogniseInvoice(inv, policy) {
  if (!Number.isInteger(inv.serviceMonths) || inv.serviceMonths < 1) {
    throw new Error("serviceMonths must be a positive integer");
  }
  const net = invoiceNetMinor(inv, policy);
  const keys = Array.from({ length: inv.serviceMonths }, (_, i) => addMonths(inv.serviceStartMonth, i));
  const parts = allocateByWeight(
    net,
    keys.map((k) => ({ key: k, weight: 1 }))
  );
  return keys.map((k) => ({
    householdId: inv.householdId,
    invoiceId: inv.invoiceId,
    serviceMonth: k,
    netMinor: parts.get(k) ?? 0,
    currency: inv.currency
  }));
}
function receiptsForMonth(invoices, month, policy) {
  return invoices.flatMap((inv) => recogniseInvoice(inv, policy)).filter((r) => r.serviceMonth === month);
}

// src/playback.ts
var DEFAULT_PLAYBACK_POLICY = {
  version: "playback-v2",
  defaultFraction: 0.7,
  shortVideoRules: [
    { maxDurationSec: 120, fraction: 0.85 },
    { maxDurationSec: 300, fraction: 0.8 }
  ],
  accessibilityFraction: 0.5,
  maxHeartbeatGapSec: 45,
  maxCastHeartbeatGapSec: 15 * 60,
  maxPlaybackRate: 1.25,
  seekToleranceSec: 2,
  maxCreditsPerWorkoutPerDay: 1,
  maxCreditsPerWorkoutPerMonth: 8,
  profileMonthlyCapSec: 30 * 3600,
  maxConcurrentStreamsPerHousehold: 4,
  timeZone: "Australia/Sydney"
};
function requiredFraction(durationSec, accessibilityMode, p) {
  if (accessibilityMode) return p.accessibilityFraction;
  for (const rule of p.shortVideoRules) {
    if (durationSec <= rule.maxDurationSec) return rule.fraction;
  }
  return p.defaultFraction;
}
function mergeIntervals(list) {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}
function intervalTotal(list) {
  return mergeIntervals(list).reduce((acc, i) => acc + (i.end - i.start), 0);
}
function extractSegments(session, heartbeats, p) {
  const flags = /* @__PURE__ */ new Set();
  if (!session.tokenIssued) {
    flags.add("no-playback-token");
    return { segments: [], flags };
  }
  const bySeq = [...heartbeats].filter((h) => h.sessionId === session.sessionId).sort((a, b) => a.seq - b.seq);
  const clean = [];
  for (const h of bySeq) {
    const last = clean[clean.length - 1];
    if (last && h.seq === last.seq) {
      flags.add("duplicate-heartbeat");
      continue;
    }
    if (last && h.receivedAt <= last.receivedAt) {
      flags.add("out-of-order-heartbeat");
      continue;
    }
    clean.push(h);
  }
  const segments = [];
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1];
    const b = clean[i];
    const wallSec = (b.receivedAt - a.receivedAt) / 1e3;
    const advanced = b.positionSec - a.positionSec;
    const casting = a.casting === true && b.casting === true;
    if (advanced <= 0) {
      if (!a.playing || !b.playing) flags.add("background-or-paused");
      continue;
    }
    if (wallSec > (casting ? p.maxCastHeartbeatGapSec : p.maxHeartbeatGapSec)) {
      flags.add("gap-too-long");
      continue;
    }
    if (!(a.visible || a.casting) || !(b.visible || b.casting)) {
      flags.add("background-or-paused");
      continue;
    }
    if (a.buffering || b.buffering) {
      flags.add("buffering");
      continue;
    }
    if (advanced > wallSec * p.maxPlaybackRate + p.seekToleranceSec) {
      flags.add("seek-detected");
      continue;
    }
    const start = Math.max(0, Math.min(a.positionSec, session.durationSec));
    const end = Math.max(0, Math.min(b.positionSec, session.durationSec));
    if (end > start) {
      segments.push({ pos: { start, end }, wall: { start: a.receivedAt, end: b.receivedAt } });
      if (a.casting || b.casting) flags.add("cast-to-tv");
    }
  }
  return { segments, flags };
}
function evaluate(session, segments, flags, p) {
  const distinct = intervalTotal(segments.map((s) => s.pos));
  const coverage = session.durationSec > 0 ? distinct / session.durationSec : 0;
  const required = requiredFraction(session.durationSec, session.accessibilityMode, p);
  const qualifies = coverage + 1e-9 >= required;
  return {
    sessionId: session.sessionId,
    segments,
    distinctWatchedSec: Math.round(distinct),
    coverage,
    requiredFraction: required,
    qualifies,
    // Credit only what was distinctly watched — never the full video length.
    creditedSec: qualifies ? Math.round(distinct) : 0,
    flags: [...flags]
  };
}
function evaluateSession(session, heartbeats, p = DEFAULT_PLAYBACK_POLICY) {
  const { segments, flags } = extractSegments(session, heartbeats, p);
  return evaluate(session, segments, flags, p);
}
function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}
function evaluateSessions(sessions, heartbeats, p = DEFAULT_PLAYBACK_POLICY) {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt || (a.sessionId < b.sessionId ? -1 : 1));
  const accepted = [];
  const results = [];
  for (const session of ordered) {
    const { segments, flags } = extractSegments(session, heartbeats, p);
    const kept = [];
    for (const seg of segments) {
      const sameProfile = accepted.some(
        (x) => x.session.profileId === session.profileId && x.session.sessionId !== session.sessionId && overlaps(x.seg.wall, seg.wall)
      );
      if (sameProfile) {
        flags.add("duplicate-profile-stream");
        continue;
      }
      const concurrentSessions = new Set(
        accepted.filter((x) => x.session.householdId === session.householdId && x.session.sessionId !== session.sessionId && overlaps(x.seg.wall, seg.wall)).map((x) => x.session.sessionId)
      );
      if (concurrentSessions.size >= p.maxConcurrentStreamsPerHousehold) {
        flags.add("concurrency-limit");
        continue;
      }
      kept.push(seg);
      accepted.push({ session, seg });
    }
    results.push(evaluate(session, kept, flags, p));
  }
  return results;
}
function dayKey(epochMs, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(epochMs));
}
function aggregateQualifiedViews(sessions, evaluations, p = DEFAULT_PLAYBACK_POLICY) {
  const byId = new Map(sessions.map((s) => [s.sessionId, s]));
  const qualifying = evaluations.filter((e) => e.qualifies && e.creditedSec > 0).map((e) => ({ e, s: byId.get(e.sessionId) })).sort((a, b) => a.s.startedAt - b.s.startedAt);
  const perDay = /* @__PURE__ */ new Map();
  const perMonth = /* @__PURE__ */ new Map();
  const profileSeconds = /* @__PURE__ */ new Map();
  const views = [];
  const anomalies = [];
  for (const { e, s } of qualifying) {
    const day2 = dayKey(s.startedAt, p.timeZone);
    const month = day2.slice(0, 7);
    const dKey = `${s.profileId}|${s.workoutId}|${day2}`;
    const mKey = `${s.profileId}|${s.workoutId}|${month}`;
    const pKey = `${s.profileId}|${month}`;
    if ((perDay.get(dKey) ?? 0) >= p.maxCreditsPerWorkoutPerDay) {
      anomalies.push({ profileId: s.profileId, reason: "repeat same day", sessionId: s.sessionId });
      continue;
    }
    if ((perMonth.get(mKey) ?? 0) >= p.maxCreditsPerWorkoutPerMonth) {
      anomalies.push({ profileId: s.profileId, reason: "monthly repeat cap", sessionId: s.sessionId });
      continue;
    }
    const used = profileSeconds.get(pKey) ?? 0;
    const allowed = Math.max(0, Math.min(e.creditedSec, p.profileMonthlyCapSec - used));
    if (allowed < e.creditedSec) {
      anomalies.push({ profileId: s.profileId, reason: "profile monthly cap", sessionId: s.sessionId });
    }
    if (allowed <= 0) continue;
    perDay.set(dKey, (perDay.get(dKey) ?? 0) + 1);
    perMonth.set(mKey, (perMonth.get(mKey) ?? 0) + 1);
    profileSeconds.set(pKey, used + allowed);
    views.push({
      householdId: s.householdId,
      profileId: s.profileId,
      workoutId: s.workoutId,
      creatorId: s.creatorId,
      day: day2,
      month,
      creditedSec: allowed,
      sessionId: s.sessionId
    });
  }
  return { views, anomalies };
}

// src/contracts.ts
var DEFAULT_REFERRAL_TERMS = {
  rateBps: 1e3,
  maxPaidMonths: 12,
  newReferralsPaused: false,
  attributionWindowDays: 30
};
var DEFAULT_PAYOUT_TERMS = {
  minPayoutMinor: 1e4,
  monthsAfterEarning: 3,
  payDay: 15
};
function inRange(month, from, to) {
  return month >= from && (to === void 0 || month <= to);
}
function royaltyEligibleInMonth(c, month) {
  if (!c.royaltyEligible) return false;
  if (!inRange(month, c.licenceStartMonth, c.licenceEndMonth)) return false;
  return !c.royaltyPauses.some((p) => inRange(month, p.fromMonth, p.toMonth));
}
function acceptsNewReferrals(c, month) {
  if (c.referral.newReferralsPaused) return false;
  return inRange(month, c.referral.acceptNewFromMonth, c.referral.acceptNewUntilMonth);
}
function contractFor(contracts, creatorId) {
  return contracts.filter((c) => c.creatorId === creatorId).sort((a, b) => b.version - a.version)[0];
}

// src/royalty.ts
var DEFAULT_ROYALTY_POLICY = {
  version: "royalty-pool-v1",
  poolRateBps: 3e3,
  zeroViewHouseholds: "redistribute",
  ineligibleCreatorViews: "redistribute-within-household"
};
function runRoyaltyPool(args) {
  const { month, isCreatorEligible } = args;
  const policy = args.policy ?? DEFAULT_ROYALTY_POLICY;
  const receipts = args.receipts.filter((r) => r.serviceMonth === month);
  const views = args.views.filter((v) => v.month === month);
  const lines = [];
  let retained = 0;
  let zeroViewPot = 0;
  const watched = /* @__PURE__ */ new Map();
  for (const v of views) {
    const h = watched.get(v.householdId) ?? /* @__PURE__ */ new Map();
    h.set(v.creatorId, (h.get(v.creatorId) ?? 0) + v.creditedSec);
    watched.set(v.householdId, h);
  }
  let poolTotal = 0;
  for (const r of [...receipts].sort((a, b) => a.invoiceId < b.invoiceId ? -1 : 1)) {
    const pool = applyRate(r.netMinor, policy.poolRateBps);
    poolTotal += pool;
    const creators = watched.get(r.householdId);
    if (!creators || creators.size === 0) {
      if (policy.zeroViewHouseholds === "redistribute") zeroViewPot += pool;
      else retained += pool;
      continue;
    }
    const eligible = [...creators.entries()].filter(([c]) => isCreatorEligible(c, month));
    const ineligibleSec = [...creators.entries()].filter(([c]) => !isCreatorEligible(c, month)).reduce((a, [, s]) => a + s, 0);
    const totalSec = [...creators.values()].reduce((a, s) => a + s, 0);
    let toAllocate = pool;
    if (policy.ineligibleCreatorViews === "retain" && ineligibleSec > 0) {
      const parts = allocateByWeight(pool, [
        { key: "__eligible", weight: totalSec - ineligibleSec },
        { key: "__retained", weight: ineligibleSec }
      ]);
      retained += parts.get("__retained") ?? 0;
      toAllocate = parts.get("__eligible") ?? 0;
    }
    if (eligible.length === 0) {
      if (policy.zeroViewHouseholds === "redistribute") zeroViewPot += toAllocate;
      else retained += toAllocate;
      continue;
    }
    const split = allocateByWeight(
      toAllocate,
      eligible.map(([creatorId, sec]) => ({ key: creatorId, weight: sec }))
    );
    for (const [creatorId, amount] of split) {
      lines.push({
        creatorId,
        month,
        amountMinor: amount,
        basis: "household-viewing",
        householdId: r.householdId,
        invoiceId: r.invoiceId,
        qualifiedSec: creators.get(creatorId)
      });
    }
  }
  if (zeroViewPot > 0) {
    const earned = /* @__PURE__ */ new Map();
    for (const l of lines) earned.set(l.creatorId, (earned.get(l.creatorId) ?? 0) + l.amountMinor);
    if (earned.size === 0) {
      retained += zeroViewPot;
    } else {
      const split = allocateByWeight(
        zeroViewPot,
        [...earned.entries()].map(([key, weight]) => ({ key, weight }))
      );
      for (const [creatorId, amount] of split) {
        if (amount !== 0) lines.push({ creatorId, month, amountMinor: amount, basis: "zero-view-redistribution" });
      }
    }
  }
  const byCreator = /* @__PURE__ */ new Map();
  for (const l of lines) byCreator.set(l.creatorId, (byCreator.get(l.creatorId) ?? 0) + l.amountMinor);
  const allocated = sumMinor(lines.map((l) => l.amountMinor));
  if (allocated + retained !== poolTotal) {
    throw new Error(`royalty run does not balance: ${allocated} + ${retained} != ${poolTotal}`);
  }
  return {
    month,
    policyVersion: policy.version,
    totalNetReceiptsMinor: sumMinor(receipts.map((r) => r.netMinor)),
    poolMinor: poolTotal,
    allocatedMinor: allocated,
    retainedMinor: retained,
    lines,
    byCreator
  };
}

// src/referral.ts
function attributeConversion(args) {
  const { conversion, touches, codes, contracts, existing, creatorEmailHashes } = args;
  if (existing.some((a) => a.householdId === conversion.householdId)) return { ok: false, reason: "already-attributed" };
  const convertedMs = new Date(conversion.convertedAt).getTime();
  let code;
  let source = "link";
  if (conversion.enteredCode) {
    code = conversion.enteredCode.trim().toUpperCase();
    source = "code";
  } else {
    const latest = touches.filter((t) => t.visitorId === conversion.visitorId && new Date(t.at).getTime() <= convertedMs).sort((a, b) => a.at < b.at ? 1 : -1)[0];
    if (!latest) return { ok: false, reason: "no-referral" };
    code = latest.code.toUpperCase();
    const contract2 = contracts.find((c) => c.creatorId === codes.find((x) => x.code === code)?.creatorId);
    const windowDays = contract2?.referral.attributionWindowDays ?? 30;
    if (convertedMs - new Date(latest.at).getTime() > windowDays * 864e5) {
      return { ok: false, reason: "outside-attribution-window" };
    }
  }
  const codeRec = codes.find((c) => c.code === code);
  if (!codeRec) return { ok: false, reason: "unknown-code" };
  if (!codeRec.active) return { ok: false, reason: "code-inactive" };
  if ((creatorEmailHashes.get(codeRec.creatorId) ?? []).includes(conversion.ownerEmailHash)) {
    return { ok: false, reason: "self-referral" };
  }
  const contract = contracts.filter((c) => c.creatorId === codeRec.creatorId).sort((a, b) => b.version - a.version)[0];
  const month = conversion.convertedAt.slice(0, 7);
  if (!contract || !acceptsNewReferrals(contract, month)) {
    return { ok: false, reason: "creator-not-accepting-referrals" };
  }
  return {
    ok: true,
    attribution: {
      householdId: conversion.householdId,
      creatorId: codeRec.creatorId,
      code: codeRec.code,
      attributedAt: conversion.convertedAt,
      contractId: contract.contractId,
      contractVersion: contract.version,
      terms: { ...contract.referral },
      source
    }
  };
}
function commissionForHousehold(attribution, receipts) {
  const paid = receipts.filter((r) => r.householdId === attribution.householdId && r.netMinor > 0 && r.serviceMonth >= attribution.attributedAt.slice(0, 7)).sort((a, b) => a.serviceMonth === b.serviceMonth ? a.invoiceId < b.invoiceId ? -1 : 1 : a.serviceMonth < b.serviceMonth ? -1 : 1);
  const lines = [];
  const countedMonths = /* @__PURE__ */ new Set();
  for (const r of paid) {
    if (!countedMonths.has(r.serviceMonth)) {
      if (countedMonths.size >= attribution.terms.maxPaidMonths) break;
      countedMonths.add(r.serviceMonth);
    }
    lines.push({
      creatorId: attribution.creatorId,
      householdId: r.householdId,
      invoiceId: r.invoiceId,
      serviceMonth: r.serviceMonth,
      paidMonthNumber: countedMonths.size,
      netMinor: r.netMinor,
      amountMinor: applyRate(r.netMinor, attribution.terms.rateBps)
    });
  }
  return {
    lines,
    paidMonthsCounted: countedMonths.size,
    remainingPaidMonths: Math.max(0, attribution.terms.maxPaidMonths - countedMonths.size)
  };
}

// src/ledger.ts
var AppendOnlyLedger = class {
  #entries = [];
  #ids = /* @__PURE__ */ new Set();
  append(entry) {
    if (this.#ids.has(entry.id)) throw new Error(`duplicate ledger entry ${entry.id}`);
    if (!Number.isSafeInteger(entry.amountMinor)) throw new Error("ledger amounts must be integer minor units");
    this.#ids.add(entry.id);
    this.#entries.push(Object.freeze({ ...entry, sourceRefs: Object.freeze([...entry.sourceRefs]) }));
  }
  /** Idempotent append — used by webhook/run retries. Returns false if already present. */
  appendOnce(entry) {
    if (this.#ids.has(entry.id)) return false;
    this.append(entry);
    return true;
  }
  all() {
    return this.#entries;
  }
  forCreator(creatorId) {
    return this.#entries.filter((e) => e.creatorId === creatorId);
  }
  balance(creatorId) {
    return sumMinor(this.forCreator(creatorId).map((e) => e.amountMinor));
  }
};
function refundReversals(args) {
  const { entries, invoiceId, refundNetMinor: refundNetMinor2, invoiceNetMinor: invoiceNetMinor2, refundId, postingMonth, runId, now } = args;
  if (invoiceNetMinor2 <= 0 || refundNetMinor2 <= 0) return [];
  const affected = entries.filter((e) => e.sourceRefs.includes(`invoice:${invoiceId}`) && !e.reversesEntryId);
  const out = [];
  for (const e of affected) {
    const parts = allocateByWeight(e.amountMinor, [
      { key: "reversed", weight: Math.min(refundNetMinor2, invoiceNetMinor2) },
      { key: "kept", weight: Math.max(0, invoiceNetMinor2 - refundNetMinor2) }
    ]);
    const reversed = parts.get("reversed") ?? 0;
    if (reversed === 0) continue;
    out.push({
      id: `${e.id}~${refundId}`,
      creatorId: e.creatorId,
      kind: "adjustment",
      amountMinor: -reversed,
      currency: e.currency,
      earningMonth: postingMonth,
      runId,
      runStatus: "provisional",
      sourceRefs: [`refund:${refundId}`, `invoice:${invoiceId}`],
      contractRef: e.contractRef,
      memo: `Refund adjustment for ${e.kind} earned ${e.earningMonth}`,
      reversesEntryId: e.id,
      createdAt: now
    });
  }
  return out;
}
function payoutDueDate(earningMonth, terms) {
  const m = addMonths(earningMonth, terms.monthsAfterEarning);
  return `${m}-${String(terms.payDay).padStart(2, "0")}`;
}
function entriesAlreadyInBatches(batches) {
  const used = /* @__PURE__ */ new Set();
  for (const b of batches) {
    if (b.status === "failed" || b.status === "cancelled") continue;
    for (const item of b.items) for (const id of item.entryIds) used.add(id);
  }
  return used;
}
function computePayable(args) {
  const { creatorId, ledger, batches, terms, asOfDate } = args;
  const used = entriesAlreadyInBatches(batches);
  const dueEntries = ledger.filter(
    (e) => e.creatorId === creatorId && e.runStatus === "final" && !used.has(e.id) && payoutDueDate(e.earningMonth, terms) <= asOfDate
  );
  const dueMinor = sumMinor(dueEntries.map((e) => e.amountMinor));
  let status = "payable";
  if (dueEntries.length === 0) status = "nothing-due";
  else if (dueMinor < 0) status = "negative-carry-forward";
  else if (dueMinor < terms.minPayoutMinor) status = "below-minimum-carry-forward";
  return { creatorId, dueEntries, dueMinor, status };
}
function createPayoutBatch(args) {
  const used = entriesAlreadyInBatches(args.existing);
  const items = [];
  for (const s of args.summaries) {
    if (s.status !== "payable") continue;
    if (s.dueEntries.some((e) => used.has(e.id))) throw new Error(`entries for ${s.creatorId} already in a batch`);
    items.push({ creatorId: s.creatorId, entryIds: s.dueEntries.map((e) => e.id), amountMinor: s.dueMinor, currency: args.currency });
  }
  return { id: args.id, status: "draft", items, createdBy: args.createdBy, audit: [{ at: args.now, by: args.createdBy, action: "created" }] };
}
function approveBatch(b, approver, now) {
  if (b.status !== "draft") throw new Error(`cannot approve a ${b.status} batch`);
  if (approver === b.createdBy) throw new Error("maker/checker: creator of a batch cannot approve it");
  return { ...b, status: "approved", approvedBy: approver, audit: [...b.audit, { at: now, by: approver, action: "approved" }] };
}
function markExported(b, by, now) {
  if (b.status !== "approved") throw new Error("only approved batches can be exported to a bank file");
  return { ...b, status: "exported", exportedAt: now, audit: [...b.audit, { at: now, by, action: "exported" }] };
}
function confirmPaid(b, c) {
  if (b.status !== "exported") throw new Error("only exported batches can be confirmed");
  if (!c.bankReference.trim() || !c.evidence.trim()) throw new Error("bank reference and evidence are required to confirm payment");
  return {
    ...b,
    status: "confirmed",
    confirmation: { bankReference: c.bankReference, evidence: c.evidence, confirmedBy: c.confirmedBy, confirmedAt: c.now },
    audit: [...b.audit, { at: c.now, by: c.confirmedBy, action: `confirmed ${c.bankReference}` }]
  };
}

// src/billing.ts
function chargeForCycle(sub, prices, cycle) {
  const price = prices.find((p) => p.priceId === sub.priceId);
  if (!price) throw new Error(`unknown price ${sub.priceId}`);
  let amount = price.amountMinor;
  const c = sub.coupon;
  const couponApplies = c && (c.duration === "forever" || c.duration === "once" && cycle === 0 || c.duration === "repeating" && cycle < (c.durationInMonths ?? 0));
  if (c && couponApplies) {
    if (c.amountOffMinor) amount -= c.amountOffMinor;
    if (c.percentOff) amount -= Math.round(amount * c.percentOff / 100);
  }
  return Math.max(0, amount);
}
function gstIncludedMinor(grossMinor) {
  return Math.round(grossMinor / 11);
}
var InMemoryEventStore = class {
  #ids = /* @__PURE__ */ new Set();
  hasProcessed(id) {
    return this.#ids.has(id);
  }
  markProcessed(id) {
    this.#ids.add(id);
  }
};
async function processBillingEvent(args) {
  const { event, store, fetchCurrent, upsertEntitlement, provider } = args;
  if (store.hasProcessed(event.eventId)) return "duplicate";
  const relevant = event.type.startsWith("customer.subscription.") || event.type.startsWith("invoice.");
  if (!relevant) {
    store.markProcessed(event.eventId);
    return "ignored";
  }
  const current = await fetchCurrent(event.subscriptionId);
  upsertEntitlement({
    householdId: current.householdId,
    provider,
    providerSubscriptionId: current.subscriptionId,
    status: current.status,
    currentPeriodEnd: current.currentPeriodEnd,
    graceDays: 3
  });
  store.markProcessed(event.eventId);
  return "processed";
}

// src/statements.ts
function buildStatement(args) {
  const { creatorId, month, ledger, batches } = args;
  const mine = ledger.filter((e) => e.creatorId === creatorId);
  const before = mine.filter((e) => e.earningMonth < month);
  const during = mine.filter((e) => e.earningMonth === month);
  const paidIn = (pred) => sumMinor(
    batches.filter((b) => b.status === "confirmed" && b.confirmation && pred(b.confirmation.confirmedAt.slice(0, 7))).flatMap((b) => b.items.filter((i) => i.creatorId === creatorId).map((i) => i.amountMinor))
  );
  const opening = sumMinor(before.map((e) => e.amountMinor)) - paidIn((m) => m < month);
  const royalties = sumMinor(during.filter((e) => e.kind === "royalty").map((e) => e.amountMinor));
  const referrals = sumMinor(during.filter((e) => e.kind === "referral").map((e) => e.amountMinor));
  const adjustments = sumMinor(during.filter((e) => e.kind === "adjustment").map((e) => e.amountMinor));
  const paidOut = paidIn((m) => m === month);
  return {
    creatorId,
    month,
    openingBalanceMinor: opening,
    royaltiesMinor: royalties,
    referralsMinor: referrals,
    adjustmentsMinor: adjustments,
    paidOutMinor: paidOut,
    closingBalanceMinor: opening + royalties + referrals + adjustments - paidOut,
    entries: during
  };
}

// src/monthEnd.ts
function fnv1a(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
function runMonthEnd(args) {
  const { month, status, invoices, refunds, views, contracts, attributions, priorEntries, now } = args;
  const currency = args.currency ?? "AUD";
  const netPolicy = args.netPolicy ?? DEFAULT_NET_RECEIPTS_POLICY;
  const royaltyPolicy = args.royaltyPolicy ?? DEFAULT_ROYALTY_POLICY;
  const runId = `run-${month}-${status}`;
  const latest = (creatorId) => contracts.filter((c) => c.creatorId === creatorId).sort((a, b) => b.version - a.version)[0];
  const receipts = receiptsForMonth(invoices, month, netPolicy);
  const royalty = runRoyaltyPool({
    month,
    receipts,
    views,
    policy: royaltyPolicy,
    isCreatorEligible: (creatorId, m) => {
      const c = latest(creatorId);
      return c ? royaltyEligibleInMonth(c, m) : false;
    }
  });
  const grouped = /* @__PURE__ */ new Map();
  for (const l of royalty.lines) {
    const key = `${l.creatorId}|${l.invoiceId ?? "pool"}|${l.basis}`;
    const g = grouped.get(key) ?? { creatorId: l.creatorId, invoiceId: l.invoiceId, amount: 0, basis: l.basis };
    g.amount += l.amountMinor;
    grouped.set(key, g);
  }
  const entries = [];
  for (const [key, g] of [...grouped.entries()].sort(([a], [b]) => a < b ? -1 : 1)) {
    if (g.amount === 0) continue;
    const c = latest(g.creatorId);
    entries.push({
      id: `roy:${month}:${key}`,
      creatorId: g.creatorId,
      kind: "royalty",
      amountMinor: g.amount,
      currency,
      earningMonth: month,
      runId,
      runStatus: status,
      sourceRefs: [g.invoiceId ? `invoice:${g.invoiceId}` : "pool:zero-view", `policy:${royaltyPolicy.version}`, `views:${month}`],
      contractRef: c ? `${c.contractId}@v${c.version}` : "none",
      memo: g.basis === "household-viewing" ? "Content royalty from household viewing" : "Share of unwatched households' pool",
      createdAt: now
    });
  }
  const recognisedToDate = invoices.flatMap((inv) => recogniseInvoice(inv, netPolicy)).filter((r) => r.serviceMonth <= month);
  for (const a of attributions) {
    const schedule = commissionForHousehold(a, recognisedToDate);
    for (const line of schedule.lines.filter((l) => l.serviceMonth === month)) {
      if (line.amountMinor === 0) continue;
      entries.push({
        id: `ref:${month}:${a.creatorId}:${line.invoiceId}`,
        creatorId: a.creatorId,
        kind: "referral",
        amountMinor: line.amountMinor,
        currency,
        earningMonth: month,
        runId,
        runStatus: status,
        sourceRefs: [`invoice:${line.invoiceId}`, `attribution:${a.householdId}`],
        contractRef: `${a.contractId}@v${a.contractVersion}`,
        memo: `Referral commission \u2014 paid month ${line.paidMonthNumber} of ${a.terms.maxPaidMonths}`,
        createdAt: now
      });
    }
  }
  const adjustments = [];
  for (const r of refunds.filter((x) => x.createdAt.slice(0, 7) === month)) {
    const inv = invoices.find((i) => i.invoiceId === r.invoiceId);
    if (!inv) continue;
    const reversals = refundReversals({
      entries: [...priorEntries, ...entries],
      invoiceId: r.invoiceId,
      refundNetMinor: refundNetMinor(r, netPolicy),
      invoiceNetMinor: invoiceNetMinor(inv, netPolicy),
      refundId: r.refundId,
      postingMonth: month,
      runId,
      now
    }).map((e) => ({ ...e, runStatus: status }));
    adjustments.push(...reversals);
  }
  entries.push(...adjustments);
  const canonical = JSON.stringify(
    entries.map((e) => [e.id, e.creatorId, e.kind, e.amountMinor, e.earningMonth, e.contractRef]).sort()
  );
  return {
    royalty,
    entries,
    snapshot: {
      runId,
      month,
      status,
      policyVersions: { netReceipts: netPolicy.version, royaltyPool: royaltyPolicy.version },
      netReceiptsMinor: royalty.totalNetReceiptsMinor,
      royaltyPoolMinor: royalty.poolMinor,
      royaltyAllocatedMinor: royalty.allocatedMinor,
      royaltyRetainedMinor: royalty.retainedMinor,
      referralMinor: sumMinor(entries.filter((e) => e.kind === "referral").map((e) => e.amountMinor)),
      adjustmentsMinor: sumMinor(adjustments.map((e) => e.amountMinor)),
      entryCount: entries.length,
      fingerprint: fnv1a(canonical)
    }
  };
}

// src/home.ts
function buildHomeRows(args) {
  const { profile, instructors, progress, favourites, completed } = args;
  const allowed = args.workouts.filter((w) => isAllowedForProfile(w, profile));
  const rows = [];
  const inProgress = allowed.filter((w) => (progress[w.id] ?? 0) > 30 && (progress[w.id] ?? 0) < w.durationSec * 0.95);
  if (inProgress.length) rows.push({ id: "continue", title: "Continue Watching", workouts: inProgress, progress });
  const recommended = allowed.filter((w) => !completed.includes(w.id)).map((w) => ({ w, score: (profile.interests.includes(w.category) ? 3 : 0) + (w.captions ? 0.2 : 0) + (favourites.includes(w.id) ? -1 : 0) })).sort((a, b) => b.score - a.score || a.w.title.localeCompare(b.w.title)).map((x) => x.w).slice(0, 10);
  if (recommended.length) rows.push({ id: "recommended", title: "Recommended for You", workouts: recommended });
  if (profile.ageBand !== "adult") {
    rows.push({ id: "age", title: "Just Right for Your Age", workouts: allowed.slice(0, 12) });
  }
  const watchedInstructors = new Set(
    allowed.filter((w) => progress[w.id] || completed.includes(w.id) || favourites.includes(w.id)).map((w) => w.instructorId)
  );
  const yours = allowed.filter((w) => watchedInstructors.has(w.instructorId));
  if (yours.length) rows.push({ id: "instructors", title: "From Your Instructors", workouts: yours });
  const recent = [...allowed].filter((w) => w.publishedAt).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 10);
  const ordered = [...CATEGORIES].sort(
    (a, b) => Number(profile.interests.includes(b)) - Number(profile.interests.includes(a))
  );
  for (const c of ordered) {
    const list = allowed.filter((w) => w.category === c);
    if (list.length) rows.push({ id: `cat-${c}`, title: CATEGORY_LABEL[c], workouts: list });
  }
  if (recent.length) rows.push({ id: "recent", title: "Recently Added", workouts: recent });
  const saved = allowed.filter((w) => favourites.includes(w.id));
  if (saved.length) rows.push({ id: "saved", title: "Saved", workouts: saved });
  void instructors;
  return rows;
}
function currentStreak(completedDays, today) {
  const days = new Set(completedDays);
  let streak = 0;
  const d = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

// src/aba.ts
var BSB = /^\d{3}-?\d{3}$/;
var ACCOUNT = /^[0-9A-Za-z-]{1,9}$/;
function abaText(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 &'()*+,\-./:;?@]/g, " ").replace(/\s+/g, " ").trim();
}
var left = (s, n) => abaText(s).slice(0, n).padEnd(n, " ");
var right = (s, n) => s.slice(-n).padStart(n, " ");
var zeros = (v, n) => {
  const s = String(v);
  if (s.length > n) throw new Error(`Amount ${v} does not fit in ${n} digits`);
  return s.padStart(n, "0");
};
var bsb = (s) => {
  if (!BSB.test(s)) throw new Error(`Invalid BSB "${s}" (expected 6 digits, e.g. 062-000)`);
  const d = s.replace("-", "");
  return `${d.slice(0, 3)}-${d.slice(3)}`;
};
var account = (s) => {
  const a = s.replace(/[\s]/g, "");
  if (!ACCOUNT.test(a)) throw new Error(`Invalid account number "${s}" (1\u20139 digits)`);
  return right(a, 9);
};
function validateAbaRemitter(r) {
  const errs = [];
  if (!/^[A-Z]{3}$/.test(r.bankCode)) errs.push("Bank code must be 3 letters (e.g. CBA, NAB, WBC, ANZ)");
  if (!/^\d{6}$/.test(r.userId)) errs.push("Direct Entry User ID must be 6 digits (from your bank)");
  if (!abaText(r.userName)) errs.push("Direct entry user name is required");
  if (!BSB.test(r.bsb)) errs.push("Your BSB must be 6 digits");
  if (!ACCOUNT.test(r.accountNumber.replace(/\s/g, ""))) errs.push("Your account number must be 1\u20139 digits");
  if (!abaText(r.accountTitle)) errs.push("Your account name is required");
  if (!abaText(r.remitterName)) errs.push("Remitter name is required");
  return errs;
}
function detail(p, r) {
  const line = "1" + bsb(p.bsb) + account(p.account) + " " + p.code + zeros(p.amount, 10) + left(p.title, 32) + left(p.reference, 18) + bsb(r.bsb) + account(r.accountNumber) + left(r.remitterName, 16) + "00000000";
  return line;
}
var ddmmyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(2, 4)}`;
function generateAba(args) {
  const { remitter: r, payments, processingDate } = args;
  const errs = validateAbaRemitter(r);
  if (errs.length) throw new Error(errs.join("; "));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(processingDate)) throw new Error("Processing date must be YYYY-MM-DD");
  if (payments.length === 0) throw new Error("No payments");
  const lines = [];
  lines.push(
    "0" + " ".repeat(17) + "01" + r.bankCode + " ".repeat(7) + left(r.userName, 26) + zeros(Number(r.userId), 6) + left(args.description, 12) + ddmmyy(processingDate) + " ".repeat(40)
  );
  let credit = 0;
  for (const p of payments) {
    if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0) throw new Error(`Payment to ${p.accountTitle} must be a positive whole number of cents`);
    if (!abaText(p.accountTitle)) throw new Error("Every payee needs an account name");
    lines.push(detail({ bsb: p.bsb, account: p.accountNumber, title: p.accountTitle, code: "50", amount: p.amountMinor, reference: p.lodgementReference }, r));
    credit += p.amountMinor;
  }
  let debit = 0;
  if (r.selfBalancing) {
    lines.push(detail({ bsb: r.bsb, account: r.accountNumber, title: r.accountTitle, code: r.balancingDebitCode ?? "13", amount: credit, reference: args.description }, r));
    debit = credit;
  }
  const count = lines.length - 1;
  lines.push(
    "7999-999" + " ".repeat(12) + zeros(Math.abs(credit - debit), 10) + zeros(credit, 10) + zeros(debit, 10) + " ".repeat(24) + zeros(count, 6) + " ".repeat(40)
  );
  for (const l of lines) if (l.length !== 120) throw new Error(`Internal error: line length ${l.length}`);
  return { text: lines.join("\r\n") + "\r\n", creditTotalMinor: credit, debitTotalMinor: debit, detailCount: count };
}
function parseAba(text) {
  const lines = text.split(/\r\n/).filter((l) => l.length > 0);
  const details = lines.filter((l) => l[0] === "1").map((l) => ({
    bsb: l.slice(1, 8),
    accountNumber: l.slice(8, 17).trim(),
    transactionCode: l.slice(18, 20),
    amountMinor: Number(l.slice(20, 30)),
    accountTitle: l.slice(30, 62).trim(),
    lodgementReference: l.slice(62, 80).trim()
  }));
  const t = lines.find((l) => l[0] === "7") ?? "";
  return {
    lineLengthsOk: lines.every((l) => l.length === 120),
    header: { bankCode: lines[0]?.slice(20, 23), userName: lines[0]?.slice(30, 56).trim(), userId: lines[0]?.slice(56, 62), date: lines[0]?.slice(74, 80) },
    details,
    totals: { net: Number(t.slice(20, 30)), credit: Number(t.slice(30, 40)), debit: Number(t.slice(40, 50)), count: Number(t.slice(74, 80)) }
  };
}
function reconcilePayments(payments, lines) {
  const used = /* @__PURE__ */ new Set();
  const results = payments.map((p) => {
    const ref = abaText(p.lodgementReference);
    const idx = lines.findIndex(
      (l, i) => !used.has(i) && Math.abs(l.amountMinor) === p.amountMinor && abaText(l.description).includes(ref)
    );
    if (idx >= 0) used.add(idx);
    return { key: p.key, amountMinor: p.amountMinor, matched: idx >= 0, line: idx >= 0 ? lines[idx] : void 0 };
  });
  return { results, allMatched: results.every((r) => r.matched), matchedTotalMinor: results.filter((r) => r.matched).reduce((a, r) => a + r.amountMinor, 0) };
}
function parseBankCsv(csv) {
  const rows = csv.split(/\r?\n/).filter((r) => r.trim()).map((r) => {
    const out = [];
    let cur = "", q = false;
    for (const ch of r) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
  if (rows.length === 0) return [];
  const head2 = rows[0].map((h) => h.toLowerCase());
  const hasHeader = head2.some((h) => /date|amount|desc|narr|ref|debit|credit/.test(h));
  const col = (re, fallback) => hasHeader ? head2.findIndex((h) => re.test(h)) : fallback;
  const iDate = col(/date/, 0), iAmt = col(/amount|debit/, 1), iDesc = col(/desc|narr|ref|detail/, 2);
  return rows.slice(hasHeader ? 1 : 0).flatMap((r) => {
    const raw = (r[iAmt] ?? "").replace(/[$,\s]/g, "");
    const amt = Math.round(Math.abs(Number(raw)) * 100);
    if (!Number.isFinite(amt) || amt === 0) return [];
    return [{ date: r[iDate] ?? "", amountMinor: amt, description: r[iDesc] ?? r.join(" ") }];
  });
}
function reconcileBatch(payments, lines, batchRef) {
  const total = payments.reduce((a, p) => a + p.amountMinor, 0);
  const each = reconcilePayments(payments, lines);
  if (each.allMatched) return { ...each, mode: "per-payment", totalMinor: total };
  const ref = abaText(batchRef);
  const lump = lines.find((l) => Math.abs(l.amountMinor) === total && (!ref || abaText(l.description).includes(ref))) ?? lines.find((l) => Math.abs(l.amountMinor) === total);
  if (lump) {
    return {
      results: payments.map((p) => ({ key: p.key, amountMinor: p.amountMinor, matched: true, line: lump })),
      allMatched: true,
      matchedTotalMinor: total,
      mode: "lump-sum",
      totalMinor: total
    };
  }
  return { ...each, mode: "unmatched", totalMinor: total };
}

// src/emails.ts
var TZ = "Australia/Sydney";
var day = (iso) => typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "the end of your current period";
var aud = (m) => typeof m === "number" ? `A$${(m / 100).toFixed(2)}` : "your plan\u2019s price";
var per = (i) => i === "year" ? "year" : "month";
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function pricePhrase(d) {
  const p = per(d.interval);
  const now = aud(d.amount_minor);
  if (typeof d.then_minor === "number" && typeof d.amount_minor === "number" && d.then_minor !== d.amount_minor) {
    const until = typeof d.discount_ends_at === "string" ? ` until ${day(d.discount_ends_at)}` : "";
    return `${now} a ${p}${until}, then ${aud(d.then_minor)} a ${p}`;
  }
  return `${now} a ${p}`;
}
function build(subject, parts, ctx) {
  const account2 = `${ctx.siteUrl.replace(/\/$/, "")}/watch/account/`;
  const footer = `You\u2019re receiving this because you have a ${ctx.brandName} family membership. Manage or cancel anytime: ${account2}` + (ctx.supportEmail ? ` \xB7 Questions? ${ctx.supportEmail}` : "");
  const text = `${parts.map((x) => x.p ? x.p : x.button ? `${x.button[0]}: ${x.button[1]}` : "").join("\n\n")}

\u2014
${footer}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0e1116"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:16px;padding:28px"><div style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(ctx.brandName)}</div>` + parts.map(
    (x) => x.p ? `<p style="font-size:16px;line-height:1.5;margin:0 0 14px">${esc(x.p)}</p>` : x.button ? `<p style="margin:20px 0"><a href="${esc(x.button[1])}" style="background:#0e1116;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">${esc(x.button[0])}</a></p>` : ""
  ).join("") + `</div><p style="font-size:12px;color:#6b7280;line-height:1.5;padding:12px 8px">${esc(footer)}</p></div></body></html>`;
  return { subject, text, html };
}
function renderNotice(kind, detail2, ctx) {
  const account2 = `${ctx.siteUrl.replace(/\/$/, "")}/watch/account/`;
  const b = ctx.brandName;
  switch (kind) {
    case "trial_started":
      return build(`Your ${b} free trial has started`, [
        { p: "Hi there," },
        { p: `Your free trial has started \u2014 every workout is unlocked for your whole family until ${day(detail2.trial_end)}.` },
        { p: `After that, your membership costs ${pricePhrase(detail2)} (GST included), charged to the card you added, and renews until you cancel.` },
        { p: `Not for you? Cancel before ${day(detail2.trial_end)} in your family account and you won\u2019t be charged anything. We\u2019ll also remind you a few days before the trial ends.` },
        { button: ["Manage membership", account2] }
      ], ctx);
    case "trial_ending":
      return build(`Reminder: your ${b} free trial ends ${day(detail2.trial_end)}`, [
        { p: "Hi there," },
        { p: `Your free trial ends on ${day(detail2.trial_end)}.` },
        detail2.cancel_at_period_end ? { p: "You\u2019ve already cancelled, so you won\u2019t be charged. Videos keep working until the trial ends." } : { p: `Unless you cancel before then, your membership will start and we\u2019ll charge ${pricePhrase(detail2)} (GST included) to the card you added. It renews until you cancel.` },
        detail2.cancel_at_period_end ? { p: "Changed your mind? You can restart your membership from your family account." } : { p: "To cancel, open your family account and choose \u201CManage membership\u201D \u2014 it takes a minute and costs nothing during the trial." },
        { button: ["Manage membership", account2] }
      ], ctx);
    case "membership_started":
      return build(`Welcome to ${b} \u2014 your membership is active`, [
        { p: "Hi there," },
        { p: `Thanks for joining! We\u2019ve received your payment of ${aud(detail2.amount_minor)} (GST included) and your family membership is active.` },
        { p: `It renews every ${per(detail2.interval)}${detail2.period_end ? ` (next on ${day(detail2.period_end)})` : ""} until you cancel. Your tax invoice is available in your family account under \u201CManage membership\u201D.` },
        { button: ["Start a workout", `${ctx.siteUrl.replace(/\/$/, "")}/watch/`] }
      ], ctx);
    case "payment_failed":
      return build(`Action needed: your ${b} payment didn\u2019t go through`, [
        { p: "Hi there," },
        { p: `We couldn\u2019t take your payment of ${aud(detail2.amount_minor)}. This usually means the card has expired or the bank declined it.` },
        { p: `Videos keep working for a few days while you sort it out.${detail2.next_attempt ? ` We\u2019ll try again on ${day(detail2.next_attempt)}.` : ""} Please update your card in your family account.` },
        { button: ["Update card", account2] }
      ], ctx);
    case "cancellation_confirmed":
      return build(`Your ${b} membership has been cancelled`, [
        { p: "Hi there," },
        { p: detail2.trialing ? `Your free trial has been cancelled and you won\u2019t be charged. Videos keep working until ${day(detail2.access_until)}.` : `Your membership has been cancelled and won\u2019t renew. Videos keep working until ${day(detail2.access_until)}, and you won\u2019t be charged again.` },
        { p: "Changed your mind? You can undo this in your family account before then." },
        { button: ["Manage membership", account2] }
      ], ctx);
    case "membership_ended":
      return build(`Your ${b} membership has ended`, [
        { p: "Hi there," },
        { p: `Your family membership ended on ${day(detail2.ended_at)} and videos are now paused. Your family\u2019s profiles are kept, so you can pick up where you left off.` },
        { button: ["Rejoin", account2] }
      ], ctx);
    case "promo_ending":
      return build(`Your ${b} offer price is ending`, [
        { p: "Hi there," },
        { p: `Your offer price of ${aud(detail2.amount_minor)} a month ${typeof detail2.discount_ends_at === "string" ? `ended on ${day(detail2.discount_ends_at)}` : "has ended"}.` },
        { p: `Your next payment, on ${day(detail2.next_charge)}, will be the normal price of ${aud(detail2.then_minor)} (GST included), and it renews monthly until you cancel.` },
        { p: "Happy to keep moving? You don\u2019t need to do anything. If you\u2019d rather stop, cancel before that date in your family account and you won\u2019t be charged again." },
        { button: ["Manage membership", account2] }
      ], ctx);
    case "price_change":
      return build(`A change to your ${b} price`, [
        { p: "Hi there," },
        { p: `From ${day(detail2.effective)}, the ${detail2.interval === "year" ? "annual" : "monthly"} membership will cost ${aud(detail2.new_minor)} a ${per(detail2.interval)} (GST included), instead of ${aud(detail2.old_minor)}.` },
        { p: `The new price applies from your first payment on or after that date. ${typeof detail2.reason === "string" && detail2.reason ? detail2.reason : ""}`.trim() },
        { p: "If you\u2019d rather not continue, you can cancel any time before then in your family account and you won\u2019t be charged the new price." },
        { button: ["Manage membership", account2] }
      ], ctx);
    default:
      throw new Error(`No email template for "${kind}"`);
  }
}

// src/avatars.ts
var AVATAR_GROUP_LABEL = {
  movers: "Movers",
  animals: "Animal athletes",
  gear: "Gear",
  animated: "On the move"
};
var INK = "#15131C";
var svg = (bg, body2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${body2}</svg>`;
var SKIN = { a: "#FCE0CC", b: "#F2C29E", c: "#D9A07A", d: "#B5774F", e: "#8A5534", f: "#5E3A23" };
var darker = (hex, k = 0.82) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c(n >> 16 & 255)}${c(n >> 8 & 255)}${c(n & 255)}`;
};
function backHair(m) {
  switch (m.hair) {
    case "long":
      return `<path d="M30 46 C28 66 30 80 36 84 L64 84 C70 80 72 66 70 46 Z" fill="${m.hairColour}"/>`;
    case "afro":
      return `<circle cx="50" cy="41" r="27" fill="${m.hairColour}"/>`;
    case "braids":
      return `<rect x="28" y="44" width="8" height="38" rx="4" fill="${m.hairColour}"/><rect x="64" y="44" width="8" height="38" rx="4" fill="${m.hairColour}"/>`;
    case "pony":
      return `<path d="M64 34 C80 36 82 56 74 66 C76 54 72 44 64 42 Z" fill="${m.hairColour}"/>`;
    default:
      return "";
  }
}
function frontHair(m) {
  const c = m.hairColour;
  switch (m.hair) {
    case "short":
      return `<path d="M33 45 C32 27 44 22 51 22 C62 22 69 29 67 45 C64 37 58 33 50 33 C42 33 36 37 33 45 Z" fill="${c}"/>`;
    case "buzz":
      return `<path d="M34 41 C34 29 42 25 50 25 C58 25 66 29 66 41 C61 34 56 32 50 32 C44 32 39 34 34 41 Z" fill="${c}" opacity=".9"/>`;
    case "long":
      return `<path d="M32 47 C30 27 43 21 51 21 C63 21 71 29 68 47 C65 36 59 31 52 31 C46 34 39 38 32 47 Z" fill="${c}"/>`;
    case "bun":
      return `<circle cx="50" cy="20" r="8" fill="${c}"/><path d="M33 43 C33 28 43 24 50 24 C57 24 67 28 67 43 C62 35 56 32 50 32 C44 32 38 35 33 43 Z" fill="${c}"/>`;
    case "pony":
      return `<path d="M33 44 C32 28 43 23 51 23 C61 23 68 29 67 44 C63 36 57 32 50 32 C43 32 37 36 33 44 Z" fill="${c}"/>`;
    case "afro":
      return `<path d="M31 42 C34 30 42 27 50 27 C58 27 66 30 69 42 C63 36 57 34 50 34 C43 34 37 36 31 42 Z" fill="${c}"/>`;
    case "braids":
      return `<path d="M33 46 C32 28 43 23 50 23 C58 23 68 28 67 46 C64 36 57 32 50 32 C43 32 36 36 33 46 Z" fill="${c}"/><path d="M50 23 L50 33" stroke="${darker(c, 0.7)}" stroke-width="1.5"/>`;
    case "curly":
      return `<g fill="${c}"><circle cx="38" cy="33" r="7"/><circle cx="47" cy="27" r="7.5"/><circle cx="57" cy="28" r="7"/><circle cx="64" cy="35" r="6.5"/><circle cx="34" cy="41" r="5"/><circle cx="66" cy="42" r="5"/></g>`;
    default:
      return "";
  }
}
function head(m) {
  const shade = darker(m.skin, 0.88);
  return `<rect x="44" y="60" width="12" height="14" rx="5" fill="${shade}"/><circle cx="33.5" cy="49" r="4" fill="${shade}"/><circle cx="66.5" cy="49" r="4" fill="${shade}"/><ellipse cx="50" cy="47" rx="16.5" ry="18.5" fill="${m.skin}"/><ellipse cx="43.5" cy="48" rx="2.1" ry="2.6" fill="${INK}"/><ellipse cx="56.5" cy="48" rx="2.1" ry="2.6" fill="${INK}"/><circle cx="40" cy="54" r="2.6" fill="#E0177A" opacity=".18"/><circle cx="60" cy="54" r="2.6" fill="#E0177A" opacity=".18"/><path d="M44.5 55.5 Q50 60.5 55.5 55.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
}
function body(m) {
  return `<path d="M17 100 C17 82 31 73 50 73 C69 73 83 82 83 100 Z" fill="${m.top}"/><path d="M42 73 Q50 80 58 73" fill="none" stroke="${darker(m.top, 0.75)}" stroke-width="2"/>`;
}
function kit(m) {
  const k = m.kitColour;
  switch (m.kit) {
    case "band":
      return `<rect x="33" y="33" width="34" height="6" rx="3" fill="${k}"/>`;
    case "bandana":
      return `<path d="M33 37 C40 31 60 31 67 37 L67 41 C60 36 40 36 33 41 Z" fill="${k}"/><path d="M67 38 L74 44 L70 46 Z" fill="${k}"/>`;
    case "cap":
      return `<path d="M32 40 C32 26 42 22 50 22 C60 22 68 27 68 40 Z" fill="${k}"/><path d="M50 37 C60 36 74 37 78 41 C70 42 58 41 50 41 Z" fill="${darker(k, 0.8)}"/><circle cx="50" cy="23" r="2" fill="${darker(k, 0.7)}"/>`;
    case "swim":
      return `<path d="M33 46 C31 27 43 22 50 22 C58 22 70 27 67 46 C63 38 57 36 50 36 C43 36 37 38 33 46 Z" fill="${k}"/><g fill="#BDEBFA" stroke="${INK}" stroke-width="1.6"><rect x="37.5" y="36" width="10" height="7" rx="3.5"/><rect x="52.5" y="36" width="10" height="7" rx="3.5"/></g><path d="M47.5 39.5 L52.5 39.5" stroke="${INK}" stroke-width="1.6"/>`;
    case "helmet":
      return `<path d="M31 42 C31 25 43 19 51 20 C63 21 70 29 69 42 Z" fill="${k}"/><g stroke="${darker(k, 0.7)}" stroke-width="2"><path d="M42 23 L40 33"/><path d="M50 21 L50 32"/><path d="M58 22 L60 33"/></g><path d="M31 42 L69 42" stroke="${INK}" stroke-width="2"/>`;
    case "gloves":
      return `<g fill="${k}" stroke="${darker(k, 0.7)}" stroke-width="1.5"><rect x="17" y="80" width="18" height="20" rx="8"/><rect x="65" y="80" width="18" height="20" rx="8"/></g><rect x="33" y="33" width="34" height="5" rx="2.5" fill="${k}"/>`;
    case "medal":
      return `<path d="M40 73 L50 88 L60 73" fill="none" stroke="${k}" stroke-width="4"/><circle cx="50" cy="91" r="6.5" fill="#FFB703" stroke="#C98A00" stroke-width="1.5"/><path d="M50 87.5 L51.2 90 L54 90.3 L52 92.2 L52.5 95 L50 93.6 L47.5 95 L48 92.2 L46 90.3 L48.8 90 Z" fill="#FFF3C4"/>`;
    case "whistle":
      return `<path d="M42 74 Q50 88 58 74" fill="none" stroke="${k}" stroke-width="2.2"/><rect x="46" y="86" width="10" height="6" rx="3" fill="#C9CCD6" stroke="${INK}" stroke-width="1.2"/>`;
    case "jersey":
      return `<text x="50" y="96" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="${k}">${m.extra ?? "7"}</text>`;
    case "ball":
      return `<circle cx="78" cy="84" r="12" fill="#FFFFFF" stroke="${INK}" stroke-width="1.6"/><path d="M78 78 L83 81.5 L81 87.5 L75 87.5 L73 81.5 Z" fill="${INK}"/>`;
    case "racket":
      return `<ellipse cx="80" cy="70" rx="9" ry="11" fill="none" stroke="${k}" stroke-width="3"/><path d="M75 78 L70 92" stroke="${darker(k, 0.6)}" stroke-width="4" stroke-linecap="round"/><g stroke="${k}" stroke-width=".8" opacity=".7"><path d="M74 66 L86 66 M73 70 L87 70 M74 74 L86 74 M80 59 L80 81 M76 60 L76 80 M84 60 L84 80"/></g><circle cx="20" cy="22" r="6" fill="#DFFF4F" stroke="#9DB52B" stroke-width="1"/>`;
    case "wrap":
      return `<path d="M33 40 C33 25 43 20 50 20 C58 20 67 25 67 40 C62 34 57 32 50 32 C43 32 38 34 33 40 Z" fill="${k}"/><circle cx="50" cy="19" r="6" fill="${darker(k, 0.85)}"/>`;
    default:
      return "";
  }
}
function mover(m) {
  return svg(m.bg, `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${backHair(m)}${body(m)}${head(m)}${frontHair(m)}${kit(m)}`);
}
var MOVERS = [
  ["@run1", "Runner with a headband", { skin: SKIN.b, hair: "pony", hairColour: "#3B2417", top: "#E0177A", kit: "band", kitColour: "#4CC9F0", bg: "#2E2A3B" }],
  ["@run2", "Runner with a cap", { skin: SKIN.e, hair: "short", hairColour: "#1B1210", top: "#4CC9F0", kit: "cap", kitColour: "#E0177A", bg: "#15131C" }],
  ["@swim1", "Swimmer with goggles", { skin: SKIN.c, hair: "none", hairColour: "#000", top: "#1B86B0", kit: "swim", kitColour: "#FFB703", bg: "#4CC9F0" }],
  ["@swim2", "Swimmer in a pink cap", { skin: SKIN.f, hair: "none", hairColour: "#000", top: "#211E2B", kit: "swim", kitColour: "#E0177A", bg: "#BDEBFA" }],
  ["@yoga1", "Yoga lover", { skin: SKIN.a, hair: "bun", hairColour: "#C2763C", top: "#3FD08F", kit: "none", kitColour: "#000", bg: "#DCF4FC" }],
  ["@yoga2", "Yoga lover with a wrap", { skin: SKIN.d, hair: "none", hairColour: "#000", top: "#FFB703", kit: "wrap", kitColour: "#7209B7", bg: "#FCE0EE" }],
  ["@danc1", "Dancer with curls", { skin: SKIN.c, hair: "curly", hairColour: "#2A1B12", top: "#7209B7", kit: "none", kitColour: "#000", bg: "#FFB703" }],
  ["@danc2", "Dancer with braids", { skin: SKIN.f, hair: "braids", hairColour: "#141010", top: "#E0177A", kit: "bandana", kitColour: "#FFB703", bg: "#2E2A3B" }],
  ["@foot1", "Footballer", { skin: SKIN.b, hair: "short", hairColour: "#E2B04A", top: "#3FD08F", kit: "ball", kitColour: "#15131C", bg: "#15131C" }],
  ["@foot2", "Footballer number 9", { skin: SKIN.e, hair: "buzz", hairColour: "#1B1210", top: "#E0177A", kit: "jersey", kitColour: "#FFFFFF", bg: "#3FD08F", extra: "9" }],
  ["@hoop1", "Basketballer number 23", { skin: SKIN.f, hair: "afro", hairColour: "#1A1311", top: "#FB8500", kit: "jersey", kitColour: "#15131C", bg: "#211E2B", extra: "23" }],
  ["@ten1", "Tennis player", { skin: SKIN.a, hair: "pony", hairColour: "#7A4A26", top: "#FFFFFF", kit: "racket", kitColour: "#E0177A", bg: "#3FD08F" }],
  ["@box1", "Boxer", { skin: SKIN.d, hair: "buzz", hairColour: "#221611", top: "#211E2B", kit: "gloves", kitColour: "#E0177A", bg: "#FFB703" }],
  ["@bike1", "Cyclist", { skin: SKIN.b, hair: "none", hairColour: "#000", top: "#FFB703", kit: "helmet", kitColour: "#4CC9F0", bg: "#7209B7" }],
  ["@coach1", "Coach with a whistle", { skin: SKIN.c, hair: "short", hairColour: "#9A9AA6", top: "#1B86B0", kit: "whistle", kitColour: "#E0177A", bg: "#FCE0EE" }],
  ["@champ1", "Champion with a medal", { skin: SKIN.e, hair: "long", hairColour: "#1B1210", top: "#E0177A", kit: "medal", kitColour: "#4CC9F0", bg: "#15131C" }],
  ["@champ2", "Champion with a gold medal", { skin: SKIN.a, hair: "short", hairColour: "#C9862E", top: "#4CC9F0", kit: "medal", kitColour: "#E0177A", bg: "#FFB703" }],
  ["@gym1", "Gymnast with a bun", { skin: SKIN.d, hair: "bun", hairColour: "#1E1410", top: "#E0177A", kit: "none", kitColour: "#000", bg: "#4CC9F0" }],
  ["@lift1", "Strong lifter", { skin: SKIN.c, hair: "buzz", hairColour: "#3B2417", top: "#15131C", kit: "band", kitColour: "#FFB703", bg: "#E0177A" }],
  ["@hike1", "Hiker with a cap", { skin: SKIN.a, hair: "long", hairColour: "#E2B04A", top: "#3FD08F", kit: "cap", kitColour: "#FB8500", bg: "#211E2B" }],
  ["@skate1", "Skater with a helmet", { skin: SKIN.f, hair: "none", hairColour: "#000", top: "#7209B7", kit: "helmet", kitColour: "#E0177A", bg: "#3FD08F" }],
  ["@net1", "Netballer", { skin: SKIN.b, hair: "pony", hairColour: "#1B1210", top: "#4CC9F0", kit: "jersey", kitColour: "#15131C", bg: "#FCE0EE", extra: "GA" }],
  ["@surf1", "Surfer", { skin: SKIN.c, hair: "long", hairColour: "#E8C170", top: "#1B86B0", kit: "none", kitColour: "#000", bg: "#FFB703" }],
  ["@martl1", "Martial artist", { skin: SKIN.a, hair: "short", hairColour: "#141010", top: "#FFFFFF", kit: "bandana", kitColour: "#E0177A", bg: "#15131C" }]
];
function animalFace(o) {
  return svg(
    o.bg,
    `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${o.ears}<ellipse cx="50" cy="56" rx="27" ry="25" fill="${o.fur}"/>` + (o.eyeRing ?? "") + `<ellipse cx="41" cy="52" rx="2.6" ry="3.2" fill="${INK}"/><ellipse cx="59" cy="52" rx="2.6" ry="3.2" fill="${INK}"/><ellipse cx="50" cy="65" rx="11" ry="8" fill="${o.snout ?? o.inner}"/><ellipse cx="50" cy="61.5" rx="3.6" ry="2.6" fill="${o.nose ?? INK}"/><path d="M45 67 Q50 71 55 67" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` + (o.extra ?? "") + (o.kit ?? "")
  );
}
var band = (c, y = 37) => `<rect x="25" y="${y}" width="50" height="6" rx="3" fill="${c}"/>`;
var ANIMALS = [
  { id: "@roo", name: "Kangaroo boxer", group: "animals", svg: animalFace({ fur: "#C98B52", inner: "#E8C39B", bg: "#E0177A", ears: `<path d="M30 40 L24 12 L40 32 Z" fill="#C98B52"/><path d="M70 40 L76 12 L60 32 Z" fill="#C98B52"/>`, kit: `<g fill="#4CC9F0" stroke="#1B86B0" stroke-width="1.5"><circle cx="20" cy="84" r="10"/><circle cx="80" cy="84" r="10"/></g>` }) },
  { id: "@koala", name: "Koala doing yoga", group: "animals", svg: animalFace({ fur: "#9CA3AF", inner: "#D6DAE1", snout: "#D6DAE1", nose: "#3B3F4A", bg: "#3FD08F", ears: `<circle cx="25" cy="38" r="13" fill="#9CA3AF"/><circle cx="75" cy="38" r="13" fill="#9CA3AF"/><circle cx="25" cy="38" r="7" fill="#F2D5DC"/><circle cx="75" cy="38" r="7" fill="#F2D5DC"/>`, kit: band("#FFB703", 34) }) },
  { id: "@fox", name: "Fox runner", group: "animals", svg: animalFace({ fur: "#FB8500", inner: "#FFF1E0", bg: "#211E2B", ears: `<path d="M28 42 L30 16 L46 34 Z" fill="#FB8500"/><path d="M72 42 L70 16 L54 34 Z" fill="#FB8500"/><path d="M32 36 L33 22 L42 33 Z" fill="#15131C" opacity=".35"/><path d="M68 36 L67 22 L58 33 Z" fill="#15131C" opacity=".35"/>`, kit: band("#E0177A") }) },
  { id: "@panda", name: "Panda lifter", group: "animals", svg: animalFace({ fur: "#FFFFFF", inner: "#F1F1F4", bg: "#4CC9F0", ears: `<circle cx="28" cy="36" r="10" fill="${INK}"/><circle cx="72" cy="36" r="10" fill="${INK}"/>`, eyeRing: `<ellipse cx="41" cy="52" rx="7" ry="8" fill="${INK}" transform="rotate(-20 41 52)"/><ellipse cx="59" cy="52" rx="7" ry="8" fill="${INK}" transform="rotate(20 59 52)"/><circle cx="41" cy="51" r="2.6" fill="#FFF"/><circle cx="59" cy="51" r="2.6" fill="#FFF"/>`, kit: band("#E0177A", 33) }) },
  { id: "@frog", name: "Frog swimmer", group: "animals", svg: animalFace({ fur: "#3FD08F", inner: "#BFF0D6", snout: "#BFF0D6", nose: "#1E7F55", bg: "#1B86B0", ears: `<circle cx="34" cy="36" r="11" fill="#3FD08F"/><circle cx="66" cy="36" r="11" fill="#3FD08F"/>`, kit: `<g fill="#BDEBFA" stroke="${INK}" stroke-width="1.6"><circle cx="34" cy="36" r="7"/><circle cx="66" cy="36" r="7"/></g><path d="M41 36 L59 36" stroke="${INK}" stroke-width="1.6"/>` }) },
  { id: "@bunny", name: "Bunny sprinter", group: "animals", svg: animalFace({ fur: "#F4F2F8", inner: "#FCE0EE", snout: "#FFFFFF", nose: "#E0177A", bg: "#7209B7", ears: `<rect x="31" y="6" width="12" height="38" rx="6" fill="#F4F2F8"/><rect x="57" y="6" width="12" height="38" rx="6" fill="#F4F2F8"/><rect x="34" y="11" width="6" height="28" rx="3" fill="#FCE0EE"/><rect x="60" y="11" width="6" height="28" rx="3" fill="#FCE0EE"/>`, kit: band("#4CC9F0") }) },
  { id: "@tiger", name: "Tiger footballer", group: "animals", svg: animalFace({ fur: "#FFB703", inner: "#FFF3D6", bg: "#15131C", ears: `<circle cx="28" cy="36" r="9" fill="#FFB703"/><circle cx="72" cy="36" r="9" fill="#FFB703"/>`, extra: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round"><path d="M50 32 L50 40"/><path d="M42 34 L44 40"/><path d="M58 34 L56 40"/><path d="M24 54 L31 55"/><path d="M76 54 L69 55"/></g>`, kit: `<circle cx="80" cy="84" r="11" fill="#FFF" stroke="${INK}" stroke-width="1.6"/><path d="M80 78.5 L84.5 81.5 L83 86.5 L77 86.5 L75.5 81.5 Z" fill="${INK}"/>` }) },
  { id: "@pengu", name: "Penguin skater", group: "animals", svg: animalFace({ fur: "#2E2A3B", inner: "#FFFFFF", snout: "#F4F2F8", nose: "#FFB703", bg: "#BDEBFA", ears: "", eyeRing: `<ellipse cx="50" cy="58" rx="19" ry="18" fill="#F4F2F8"/>`, kit: `<path d="M27 46 C27 30 38 26 50 26 C62 26 73 30 73 46 Z" fill="#E0177A"/><circle cx="50" cy="25" r="4" fill="#FFFFFF"/>` }) }
];
var tile = (bg, body2) => svg(bg, `<circle cx="50" cy="50" r="38" fill="#FFFFFF" opacity=".12"/>${body2}`);
var GEAR = [
  { id: "@dumb", name: "Dumbbell", group: "gear", svg: tile("#E0177A", `<g fill="${INK}"><rect x="18" y="36" width="10" height="28" rx="3"/><rect x="72" y="36" width="10" height="28" rx="3"/><rect x="28" y="40" width="7" height="20" rx="2"/><rect x="65" y="40" width="7" height="20" rx="2"/></g><rect x="35" y="47" width="30" height="6" rx="3" fill="#F4F2F8"/>`) },
  { id: "@kettl", name: "Kettlebell", group: "gear", svg: tile("#4CC9F0", `<path d="M38 40 C36 22 64 22 62 40" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="58" r="21" fill="${INK}"/><text x="50" y="64" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="13" fill="#4CC9F0">8kg</text>`) },
  { id: "@shoe", name: "Running shoe", group: "gear", svg: tile("#FFB703", `<path d="M16 66 C16 54 22 44 30 42 L42 52 C52 56 70 56 82 62 C86 64 86 72 82 72 L20 72 C17 72 16 70 16 66 Z" fill="#E0177A"/><rect x="16" y="70" width="70" height="7" rx="3.5" fill="#F4F2F8" stroke="${INK}" stroke-width="1.5"/><g stroke="#F4F2F8" stroke-width="2.5" stroke-linecap="round"><path d="M36 50 L42 46"/><path d="M41 54 L47 50"/><path d="M46 57 L52 53"/></g>`) },
  { id: "@watch", name: "Stopwatch", group: "gear", svg: tile("#3FD08F", `<rect x="45" y="16" width="10" height="8" rx="2" fill="${INK}"/><circle cx="50" cy="55" r="27" fill="#F4F2F8" stroke="${INK}" stroke-width="5"/><path d="M50 55 L50 38" stroke="#E0177A" stroke-width="4" stroke-linecap="round"/><path d="M50 55 L62 61" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="55" r="3" fill="${INK}"/>`) },
  { id: "@medal", name: "Gold medal", group: "gear", svg: tile("#7209B7", `<path d="M34 14 L46 46 L54 46 L66 14 L56 14 L50 34 L44 14 Z" fill="#E0177A"/><circle cx="50" cy="62" r="20" fill="#FFB703" stroke="#C98A00" stroke-width="3"/><path d="M50 50 L53.5 57.5 L61.5 58.3 L55.5 63.6 L57.2 71.5 L50 67.5 L42.8 71.5 L44.5 63.6 L38.5 58.3 L46.5 57.5 Z" fill="#FFF3C4"/>`) },
  { id: "@troph", name: "Trophy", group: "gear", svg: tile("#15131C", `<path d="M33 22 L67 22 L64 48 C62 58 56 62 50 62 C44 62 38 58 36 48 Z" fill="#FFB703"/><path d="M33 28 C20 28 22 46 36 46" fill="none" stroke="#FFB703" stroke-width="5"/><path d="M67 28 C80 28 78 46 64 46" fill="none" stroke="#FFB703" stroke-width="5"/><rect x="45" y="62" width="10" height="12" fill="#C98A00"/><rect x="34" y="74" width="32" height="8" rx="2" fill="#E0177A"/>`) },
  { id: "@bottl", name: "Water bottle", group: "gear", svg: tile("#E0177A", `<rect x="42" y="14" width="16" height="10" rx="3" fill="${INK}"/><rect x="34" y="24" width="32" height="62" rx="10" fill="#4CC9F0"/><rect x="34" y="44" width="32" height="18" fill="#F4F2F8"/><path d="M40 70 Q44 66 48 70 T56 70" fill="none" stroke="#F4F2F8" stroke-width="2.5"/>`) },
  { id: "@rope", name: "Skipping rope", group: "gear", svg: tile("#4CC9F0", `<path d="M26 70 C26 18 74 18 74 70" fill="none" stroke="#E0177A" stroke-width="4"/><rect x="20" y="66" width="12" height="22" rx="5" fill="${INK}"/><rect x="68" y="66" width="12" height="22" rx="5" fill="${INK}"/>`) },
  { id: "@socc", name: "Soccer ball", group: "gear", svg: tile("#3FD08F", `<circle cx="50" cy="50" r="28" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><path d="M50 38 L61 46 L57 59 L43 59 L39 46 Z" fill="${INK}"/><g stroke="${INK}" stroke-width="2.5"><path d="M50 38 L50 23"/><path d="M61 46 L75 41"/><path d="M57 59 L66 71"/><path d="M43 59 L34 71"/><path d="M39 46 L25 41"/></g>`) },
  { id: "@bball", name: "Basketball", group: "gear", svg: tile("#211E2B", `<circle cx="50" cy="50" r="28" fill="#FB8500" stroke="${INK}" stroke-width="2.5"/><g fill="none" stroke="${INK}" stroke-width="2.5"><path d="M22 50 L78 50"/><path d="M50 22 L50 78"/><path d="M30 30 C40 40 40 60 30 70"/><path d="M70 30 C60 40 60 60 70 70"/></g>`) },
  { id: "@bike", name: "Bike", group: "gear", svg: tile("#FFB703", `<g fill="none" stroke="${INK}" stroke-width="4"><circle cx="28" cy="62" r="14"/><circle cx="72" cy="62" r="14"/></g><path d="M28 62 L42 40 L62 40 L72 62 M42 40 L52 62 L62 40 M56 32 L66 32 M42 40 L38 32" fill="none" stroke="#E0177A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "@mat", name: "Yoga mat", group: "gear", svg: tile("#FCE0EE", `<rect x="18" y="56" width="64" height="16" rx="3" fill="#7209B7"/><path d="M82 64 C92 64 92 40 76 40 L30 40 C20 40 18 50 26 54 L74 54 C80 54 82 60 82 64 Z" fill="#E0177A"/><circle cx="76" cy="50" r="6" fill="#7209B7"/>`) },
  { id: "@heart", name: "Heart", group: "gear", svg: tile("#15131C", `<path d="M50 78 C24 60 18 44 26 32 C33 22 46 24 50 34 C54 24 67 22 74 32 C82 44 76 60 50 78 Z" fill="#E0177A"/><path d="M22 52 L38 52 L44 42 L52 62 L58 50 L78 50" fill="none" stroke="#F4F2F8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`) },
  { id: "@flame", name: "Flame", group: "gear", svg: tile("#211E2B", `<path d="M50 14 C58 30 74 38 72 60 C70 76 60 84 50 84 C38 84 28 76 28 62 C28 50 36 44 38 34 C44 40 46 46 46 52 C52 44 54 30 50 14 Z" fill="#FB8500"/><path d="M50 50 C56 58 62 62 60 72 C58 80 54 82 50 82 C44 82 40 78 40 70 C40 62 46 60 50 50 Z" fill="#FFB703"/>`) },
  { id: "@bolt", name: "Lightning bolt", group: "gear", svg: tile("#7209B7", `<path d="M56 12 L26 56 L46 56 L40 88 L74 40 L54 40 Z" fill="#FFB703" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "@peak", name: "Mountain peak", group: "gear", svg: tile("#4CC9F0", `<path d="M10 82 L38 34 L54 58 L64 44 L90 82 Z" fill="#2E2A3B"/><path d="M38 34 L46 48 L40 46 L34 50 L30 47 Z" fill="#F4F2F8"/><path d="M64 44 L70 54 L62 52 Z" fill="#F4F2F8"/><path d="M64 44 L64 20 L78 25 L64 30" fill="#E0177A" stroke="${INK}" stroke-width="1.5"/>`) },
  { id: "@star", name: "Star", group: "gear", svg: tile("#E0177A", `<path d="M50 14 L60 38 L86 40 L66 57 L72 82 L50 69 L28 82 L34 57 L14 40 L40 38 Z" fill="#FFB703" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`) },
  { id: "@whist", name: "Whistle", group: "gear", svg: tile("#3FD08F", `<path d="M22 46 C22 36 30 30 40 30 L74 30 L74 44 L60 44 C62 48 62 54 60 58 C56 68 44 72 34 68 C26 64 22 56 22 46 Z" fill="#C9CCD6" stroke="${INK}" stroke-width="3"/><circle cx="40" cy="52" r="7" fill="${INK}"/><path d="M74 30 L80 22" stroke="#E0177A" stroke-width="3"/>`) }
];
var ANIMATED = [
  { id: "@abounce", name: "Bouncing basketball", group: "animated", svg: svg("#211E2B", `<ellipse cx="50" cy="86" rx="18" ry="4" fill="#000" opacity=".35"><animate attributeName="rx" values="18;10;18" dur="1s" repeatCount="indefinite"/></ellipse><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -26;0 0" keyTimes="0;.5;1" keySplines=".3 0 .7 1;.3 0 .7 1" calcMode="spline" dur="1s" repeatCount="indefinite"/><circle cx="50" cy="62" r="20" fill="#FB8500" stroke="${INK}" stroke-width="2"/><g fill="none" stroke="${INK}" stroke-width="2"><path d="M30 62 L70 62"/><path d="M50 42 L50 82"/><path d="M36 48 C43 56 43 68 36 76"/><path d="M64 48 C57 56 57 68 64 76"/></g></g>`) },
  { id: "@aheart", name: "Beating heart", group: "animated", svg: svg("#15131C", `<g transform="translate(50 50)"><g><animateTransform attributeName="transform" type="scale" values="1;1.14;1;1.08;1" dur="1.1s" repeatCount="indefinite"/><path d="M0 28 C-26 10 -32 -6 -24 -18 C-17 -28 -4 -26 0 -16 C4 -26 17 -28 24 -18 C32 -6 26 10 0 28 Z" fill="#E0177A"/></g></g>`) },
  { id: "@aflame", name: "Flickering flame", group: "animated", svg: svg("#2E2A3B", `<g transform="translate(50 84)"><g><animateTransform attributeName="transform" type="scale" values="1 1;0.96 1.06;1.03 0.97;1 1" dur="0.9s" repeatCount="indefinite"/><path d="M0 -70 C8 -54 24 -46 22 -24 C20 -8 10 0 0 0 C-12 0 -22 -8 -22 -22 C-22 -34 -14 -40 -12 -50 C-6 -44 -4 -38 -4 -32 C2 -40 4 -54 0 -70 Z" fill="#FB8500"/><path d="M0 -34 C6 -26 12 -22 10 -12 C8 -4 4 -2 0 -2 C-6 -2 -10 -6 -10 -14 C-10 -22 -4 -24 0 -34 Z" fill="#FFB703"/></g></g>`) },
  { id: "@awatch", name: "Ticking stopwatch", group: "animated", svg: svg("#3FD08F", `<rect x="45" y="14" width="10" height="8" rx="2" fill="${INK}"/><circle cx="50" cy="54" r="28" fill="#F4F2F8" stroke="${INK}" stroke-width="5"/><g><animateTransform attributeName="transform" type="rotate" from="0 50 54" to="360 50 54" dur="4s" repeatCount="indefinite"/><path d="M50 54 L50 34" stroke="#E0177A" stroke-width="4" stroke-linecap="round"/></g><circle cx="50" cy="54" r="3.5" fill="${INK}"/>`) },
  { id: "@awave", name: "Swimming waves", group: "animated", svg: svg("#4CC9F0", `<g fill="none" stroke="#F4F2F8" stroke-width="5" stroke-linecap="round"><path d="M-20 40 Q-10 32 0 40 T20 40 T40 40 T60 40 T80 40 T100 40 T120 40"><animateTransform attributeName="transform" type="translate" values="0 0;-20 0" dur="1.2s" repeatCount="indefinite"/></path><path d="M-20 60 Q-10 52 0 60 T20 60 T40 60 T60 60 T80 60 T100 60 T120 60" stroke="#1B86B0"><animateTransform attributeName="transform" type="translate" values="-20 0;0 0" dur="1.5s" repeatCount="indefinite"/></path><path d="M-20 80 Q-10 72 0 80 T20 80 T40 80 T60 80 T80 80 T100 80 T120 80"><animateTransform attributeName="transform" type="translate" values="0 0;-20 0" dur="1.8s" repeatCount="indefinite"/></path></g><circle cx="74" cy="22" r="9" fill="#FFB703"/>`) },
  { id: "@astar", name: "Spinning star", group: "animated", svg: svg("#7209B7", `<g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite"/><path d="M50 16 L59 39 L84 41 L65 57 L71 81 L50 68 L29 81 L35 57 L16 41 L41 39 Z" fill="#FFB703" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g><g fill="#F4F2F8"><circle cx="20" cy="22" r="2.5"><animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="82" cy="80" r="2.5"><animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite"/></circle></g>`) },
  { id: "@adance", name: "Dancing mover", group: "animated", svg: (() => {
    const m = { skin: SKIN.c, hair: "curly", hairColour: "#2A1B12", top: "#E0177A", kit: "none", kitColour: "#000", bg: "#FFB703" };
    return svg(m.bg, `<circle cx="50" cy="52" r="40" fill="#FFFFFF" opacity=".13"/>${body(m)}<g><animateTransform attributeName="transform" type="rotate" values="-8 50 72;8 50 72;-8 50 72" dur="1s" repeatCount="indefinite"/>${backHair(m)}${head(m)}${frontHair(m)}</g><g fill="${INK}"><path d="M14 30 l0 -14 l8 -2 l0 12" stroke="${INK}" stroke-width="2" fill="none"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></path><circle cx="12" cy="31" r="3"/><circle cx="20" cy="29" r="3"/></g>`);
  })() },
  { id: "@ajump", name: "Jumping runner", group: "animated", svg: (() => {
    const m = { skin: SKIN.e, hair: "pony", hairColour: "#1B1210", top: "#4CC9F0", kit: "band", kitColour: "#E0177A", bg: "#211E2B" };
    return svg(m.bg, `<ellipse cx="50" cy="97" rx="26" ry="4" fill="#000" opacity=".35"/><g><animateTransform attributeName="transform" type="translate" values="0 6;0 -6;0 6" keyTimes="0;.5;1" keySplines=".3 0 .7 1;.3 0 .7 1" calcMode="spline" dur="0.8s" repeatCount="indefinite"/>${backHair(m)}${body(m)}${head(m)}${frontHair(m)}${kit(m)}</g>`);
  })() }
];
var AVATARS = [
  ...MOVERS.map(([id, name, m]) => ({ id, name, group: "movers", svg: mover(m) })),
  ...ANIMALS,
  ...GEAR,
  ...ANIMATED
];
var AVATAR_GROUPS = ["movers", "animals", "gear", "animated"];
var BY_ID = new Map(AVATARS.map((a) => [a.id, a]));
var avatarById = (value) => value && value.startsWith("@") ? BY_ID.get(value) : void 0;
var stillSvg = (s) => s.replace(/<animate(Transform)?\b[^>]*\/>/g, "").replace(/<animate(Transform)?\b[^>]*>[\s\S]*?<\/animate(Transform)?>/g, "");
export {
  AGE_BANDS,
  AGE_BAND_LABEL,
  AVATARS,
  AVATAR_GROUPS,
  AVATAR_GROUP_LABEL,
  AppendOnlyLedger,
  CATEGORIES,
  CATEGORY_LABEL,
  CONTENT_STATES,
  DEFAULT_NET_RECEIPTS_POLICY,
  DEFAULT_PAYOUT_TERMS,
  DEFAULT_PLAYBACK_POLICY,
  DEFAULT_REFERRAL_TERMS,
  DEFAULT_ROYALTY_POLICY,
  InMemoryEventStore,
  abaText,
  acceptsNewReferrals,
  addMonths,
  aggregateQualifiedViews,
  allocateByWeight,
  applyRate,
  approveBatch,
  assertMinor,
  attributeConversion,
  avatarById,
  buildHomeRows,
  buildStatement,
  canPublish,
  chargeForCycle,
  commissionForHousehold,
  computePayable,
  confirmPaid,
  contractFor,
  createPayoutBatch,
  currentStreak,
  decidePlayback,
  entriesAlreadyInBatches,
  evaluateSession,
  evaluateSessions,
  extractSegments,
  filterWorkouts,
  formatDuration,
  formatMoney,
  generateAba,
  gstIncludedMinor,
  hasStreamingAccess,
  invoiceNetMinor,
  isAllowedForProfile,
  isChildBand,
  markExported,
  mergeIntervals,
  money,
  monthsBetween,
  parseAba,
  parseBankCsv,
  payoutDueDate,
  pct,
  processBillingEvent,
  receiptsForMonth,
  recogniseInvoice,
  reconcileBatch,
  reconcilePayments,
  refundNetMinor,
  refundReversals,
  renderNotice,
  requiredFraction,
  royaltyEligibleInMonth,
  runMonthEnd,
  runRoyaltyPool,
  stillSvg,
  suitabilityLabel,
  sumMinor,
  validateAbaRemitter
};
