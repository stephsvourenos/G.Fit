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
function isChildBand(band) {
  return band !== "adult";
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
  const head = rows[0].map((h) => h.toLowerCase());
  const hasHeader = head.some((h) => /date|amount|desc|narr|ref|debit|credit/.test(h));
  const col = (re, fallback) => hasHeader ? head.findIndex((h) => re.test(h)) : fallback;
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
  const text = [
    ...parts.map((x) => x.p ? x.p : x.button ? `${x.button[0]}: ${x.button[1]}` : ""),
    "",
    "\u2014",
    footer
  ].join("\n\n");
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
        { button: ["Start a workout", account2] }
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
    default:
      throw new Error(`No email template for "${kind}"`);
  }
}
export {
  AGE_BANDS,
  AGE_BAND_LABEL,
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
  sumMinor,
  validateAbaRemitter
};
