#!/usr/bin/env python3
"""
Independent cross-check of a month-end run (acceptance tests 3, 4 and 5 against the database).

Recomputes a month's creator royalties, referral commission and refund reversals straight from
the raw database tables, using a SEPARATE implementation of the written policy (it does not use
packages/domain), then compares every creator's totals with the system's month-end preview.

Usage (admin or finance test account):
  SUPABASE_URL=... SUPABASE_KEY=<publishable key> STAFF_EMAIL=... STAFF_PASSWORD=... \
    python3 scripts/verify-month-end.py 2026-11

Policy implemented (see docs/ARCHITECTURE.md and packages/domain for the authoritative version):
  net receipts = paid − GST − Stripe fee; annual invoices are spread over 12 months
  (leftover cents to the earliest months). Pool = 30% of each month's receipt (half-up).
  Each household's pool share goes only to ELIGIBLE creators it watched (paid viewing), by
  qualified seconds; households with no eligible viewing are shared pro-rata to creators'
  viewing earnings. Referral = rate × each paid month's receipt, frozen terms, up to max paid
  months. A refund in the month reverses the refunded share of entries earned from that invoice.
"""
import json, os, sys, urllib.request
from collections import defaultdict
from zoneinfo import ZoneInfo
from datetime import datetime

URL, KEY = os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"]
MONTH = sys.argv[1]


def req(path, body=None, token=None, method=None):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read() or "null")


tok = req("/auth/v1/token?grant_type=password", {"email": os.environ["STAFF_EMAIL"], "password": os.environ["STAFF_PASSWORD"]})["access_token"]
get = lambda p: req("/rest/v1/" + p, token=tok)
syd = lambda iso: datetime.fromisoformat(iso).astimezone(ZoneInfo("Australia/Sydney")).strftime("%Y-%m")


def add_months(m, n):
    y, mo = map(int, m.split("-"))
    t = y * 12 + mo - 1 + n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def rate(amount, bps):  # half-up, symmetric for negatives
    q, r = divmod(abs(amount) * bps, 10000)
    v = q + (1 if r * 2 >= 10000 else 0)
    return v if amount >= 0 else -v


def split(total, weights):  # largest remainder; ties to the earlier key
    tw = sum(weights.values())
    base = {k: total * w // tw for k, w in weights.items()}
    left = total - sum(base.values())
    order = sorted(weights, key=lambda k: (-((total * weights[k]) % tw), k))
    for k in order[:left]:
        base[k] += 1
    return base


# ---------- raw inputs ----------
invoices = get("billing_invoices?status=eq.paid&amount_paid_minor=gt.0&select=*")
refunds = get("billing_refunds?status=eq.succeeded&select=*")
views = get(f"qualified_views?month=eq.{MONTH}&select=*,playback_sessions!inner(membership_provider,membership_status)"
            "&playback_sessions.membership_provider=eq.stripe&playback_sessions.membership_status=in.(active,past_due)")
contracts = {}
for c in get("creator_contracts?select=*&order=version"):
    contracts[c["creator_id"]] = c["terms"]
attrs = get("referral_attributions?terms=not.is.null&select=*")


def eligible(cid):
    t = contracts.get(cid)
    if not t or not t.get("royaltyEligible"):
        return False
    if MONTH < t["licenceStartMonth"] or (t.get("licenceEndMonth") and MONTH > t["licenceEndMonth"]):
        return False
    return not any(p["fromMonth"] <= MONTH <= p["toMonth"] for p in t.get("royaltyPauses", []))


net = {}
receipts = []  # (invoice, household, month, net)
for i in invoices:
    n = max(0, i["amount_paid_minor"] - i["gst_minor"] - (i["processor_fee_minor"] or 0))
    net[i["id"]] = n
    months = 12 if i["billing_interval"] == "year" else 1
    start = syd(i["period_start"])
    for k in range(months):
        receipts.append((i["id"], i["household_id"], add_months(start, k), n // months + (1 if k < n % months else 0)))

# ---------- royalty pool ----------
watched = defaultdict(lambda: defaultdict(int))
for v in views:
    watched[v["household_id"]][v["creator_id"]] += v["credited_sec"]
earned = defaultdict(int)                     # creator -> royalty
from_invoice = defaultdict(lambda: defaultdict(int))  # invoice -> creator -> royalty (for refunds)
zero_pot = 0
for inv, hh, m, n in sorted(receipts):
    if m != MONTH:
        continue
    pool = rate(n, 3000)
    elig = {c: s for c, s in watched.get(hh, {}).items() if eligible(c)}
    if not elig:
        zero_pot += pool
        continue
    for c, a in split(pool, elig).items():
        earned[c] += a
        from_invoice[inv][c] += a
if zero_pot and earned:
    for c, a in split(zero_pot, dict(earned)).items():
        earned[c] += a

# ---------- referral ----------
referral = defaultdict(int)
ref_from_invoice = defaultdict(lambda: defaultdict(int))
for a in attrs:
    t = a["terms"]
    paid = sorted((m, inv, n) for inv, hh, m, n in receipts
                  if hh == a["household_id"] and n > 0 and m >= syd(a["attributed_at"]) and m <= MONTH)
    counted = []
    for m, inv, n in paid:
        if m not in counted:
            if len(counted) >= t["maxPaidMonths"]:
                break
            counted.append(m)
        if m == MONTH:
            amt = rate(n, t["rateBps"])
            referral[a["creator_id"]] += amt
            ref_from_invoice[inv][a["creator_id"]] += amt

# ---------- refunds posted this month ----------
adjust = defaultdict(int)
for r in refunds:
    if syd(r["created_at"]) != MONTH or r["invoice_id"] not in net:
        continue
    rnet = max(0, r["amount_minor"] - round(r["amount_minor"] / 11))
    inet = net[r["invoice_id"]]
    for src in (from_invoice[r["invoice_id"]], ref_from_invoice[r["invoice_id"]]):
        for c, amt in src.items():
            parts = split(amt, {"kept": max(0, inet - rnet), "reversed": min(rnet, inet)}) if inet else {"reversed": 0}
            adjust[c] -= parts.get("reversed", 0)

# ---------- compare with the system ----------
system = req("/functions/v1/month-end", {"action": "preview", "month": MONTH}, token=tok)
ok = True
for s in system["statements"]:
    c = s["creator_id"]
    mine = (earned.get(c, 0), referral.get(c, 0), adjust.get(c, 0))
    theirs = (s["royalties_minor"], s["referrals_minor"], s["adjustments_minor"])
    flag = "OK " if mine == theirs else "MISMATCH"
    ok &= mine == theirs
    print(f"{flag} {c[:8]}  royalty {theirs[0]:>6}  referral {theirs[1]:>5}  adjustments {theirs[2]:>5}" + ("" if mine == theirs else f"   expected {mine}"))
pool_total = sum(rate(n, 3000) for _, _, m, n in receipts if m == MONTH)
print(f"pool {system['royalty_pool_minor']} (independent {pool_total}); net {system['net_receipts_minor']}; fingerprint {system['fingerprint']}")
ok &= pool_total == system["royalty_pool_minor"]
print("ALL MATCH" if ok else "DIFFERENCES FOUND")
sys.exit(0 if ok else 1)
