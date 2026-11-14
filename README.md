# Token Radar — model radar-2

- Bounty: https://make.fun/bounty/token-radar-01
- Prize: $1,325 USDC (1st $1,000, 2nd–5th $50, 6th–10th $25)
- Deadline: Mon 14 Dec 2026, 17:00 WIB (10:10 UTC)
- Status: **BUILT, NOT SUBMITTED** — no GitHub repo created, no entry submitted,
  nothing signed, nothing paid, no wallet connected.

## What it is

One Node 22 program (`main.ts`, standard library only) that reads the sealed DefiLlama
snapshot at `/input/snapshot.json` and writes a ranked board of pre-token protocols to
`/output/board.json`, plus a static dashboard (`dashboard/`) that renders it with no
network and no framework.

## The model (radar-2)

Every rankable pre-token protocol in the snapshot is scored by one function of the
snapshot's own figures — no protocol name is special-cased:

```
implied = round( tvl_usd x 0.25
               x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
               x (0.6 + min(age_days, 1095) / 1095 x 0.4)
               x (1 + 0.05 x min(chains - 1, 4)) )
```

- **TVL** is the anchor: a bigger protocol's token would be worth more.
- **Seven-day growth** is the momentum, clamped so one wild week cannot dominate.
- **Maturity** is how long the protocol has run with no token on record; an unlisted
  age uses 365 days.
- **Breadth** is the chain count: one chain adds nothing, each extra chain up to four
  adds 5% — more chains mean more places to farm and more routes for value to arrive.

A protocol is rankable when it records no token (no market cap, no CoinGecko id, no
symbol) **and** is not a wrapped, staked or bridged product of a token that already
trades: WBTC, Binance staked ETH and USDT0 record no token in this snapshot either,
yet each is a product of a token that trades, so the board sets them aside with the
live tokens instead of ranking them as "still to come". The board applies the
watchlist's own rule (minus its TVL floor, which is a floor, never a ceiling).

## The board

- **198 rows**: the whole 40-protocol watchlist plus every other rankable pre-token
  protocol in the snapshot (158 early rows below and above the floor).
- Rank 1: Steakhouse Financial, implied $652,363,296. Top 5: Steakhouse Financial,
  Sentora Curator, Gauntlet, Veda, USDD.
- Every row carries a **7-step farm plan** derived from the protocol's own record
  (category, chains, TVL, age): a concrete first action, a second action or a second
  chain, a weekly qualifying action, a hold period, a points-page check, and a farm
  log with an exit. Gas follows the first chain: about $1 a transaction on cheap
  chains (Solana, Base, Arbitrum, …), about $8 on Ethereum. Each step states its
  cost and its time.
- The 24 largest live-token protocols are set aside in a separate view with their
  market caps — the market's own values, never the model's.

## The dashboard

- Top-5 spotlight cards, a sortable board (rank, protocol, TVL, 7d growth, age,
  implied value), and filters: search, category, chain, minimum TVL, pre-token /
  live-token tabs. A detail drawer for each protocol shows the model's inputs, the
  recomputed implied value (the page re-derives it and checks it against
  `board.json`), a sentence saying why it ranks where it does, and its farm plan.
- The model panel states the formula and what the board is not: a prediction that a
  token will be issued, or when. A protocol "records no token" in this snapshot;
  that is the record, not proof it has none.
- Below the board: a top-movers strip (the five fastest-growing pre-token protocols
  over seven days), a category summary table (rows, combined TVL and strongest
  protocol per category, with a CSV download of the filtered board), a reading guide
  in five steps, and a footer stating the snapshot date and counts (758 protocols,
  40 on the watchlist, 198 rows, 24 live set aside).
- Screenshots (`screenshots/`, 1280×800 PNGs, 292–358 KB each) are renders of the
  dashboard from the same data: `1-board.png` the board, `2-detail.png` the rank-1
  detail drawer, `3-filtered.png` the board filtered to Lending.

## Run it

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

## Verification results (15 Nov 2026, ~03:30 WIB)

- `node main.ts` — **198 rows scored (40 watchlist + 158 early, 24 live set aside)**.
  Ranks exactly 1–198, implied values non-increasing, 7 farm steps per row, each
  124–175 characters, watchlist fully covered.
- Two runs byte-identical (`diff -r out out2` clean): **deterministic**.
- `board.json` 315,558 bytes (cap 8 MiB), `data.js` 73,533 bytes, dashboard source
  36,063 bytes total (dossier text cap 65,536), `dossier.json` 1,309,257 bytes
  (cap 1.5 MiB), screenshots 292–358 KB each (cap 512 KiB, long side 1280, short
  side 800).
- No `http://` or `https://` address in any dashboard file (no network).
- Kit `check` on commit `a342934` (15 Nov 2026, ~03:45 WIB): **11 passed, 1 failed,
  6 skipped, 5 checked at submission**. `thinking_reproduces` passes at 30.4%
  (465 of 1,529 counted lines authored). The one failure is `thinking_priced`: the
  bundle carries 0 usage rows, because a subagent's usage row is written only once
  its run completes. The parent agent must query muse.db for agent
  `e8d8a0a6-4580-4e01-912f-b72942fa7342`, re-bundle with `--muse-usage <file>`, and
  re-run the check; that is the only remaining local failure.

## Files

- `main.ts` — the entrypoint (Node 22, stdlib only)
- `lib/model.ts` — the radar-2 model, farm plans, board builder
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
- `dashboard/` — `index.html`, `app.css`, `app.js` (no network, no framework)
- `screenshots/` — `1-board.png`, `2-detail.png`, `3-filtered.png`
- `LICENSE` — MIT (SPDX-License-Identifier: MIT)
- `.makefun/owner.json` — `{"wallet": "FxmXf1NPQE1YyVZYZAEPoDxVzw1YSxRGYAzcmMNQZ3s"}`

## What remains before submission (NOT done)

1. Create a public GitHub repo owned by hamkazhaa, created after the bounty opened,
   and push this commit.
2. Bundle this session's transcripts with the kit CLI (`--muse-usage` for the
   building agent) and run `makefun check` — expect all local checks to pass.
3. Submit as @hamka (agent-connect is approved for this account; the agent wallet
   becomes the signing/payout wallet) before Mon 14 Dec 2026 17:00 WIB.
