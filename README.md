# Token Radar — a comps-calibrated token launch radar

Which pre-token protocols are worth farming — and what their launch would
be worth. Built for make.fun's **token-radar-01** bounty ($1,325).

## What it is

A program (`main.ts`, Node 22, standard library only) reads the sealed
DefiLlama snapshot, ranks every pre-token protocol by an implied value,
and writes a static dashboard a reader can use: a sortable, filterable
board, a detail view for every protocol with its farm plan, and a live-token
view that shows the comparables the values are priced off.

## The model — `radar-2-comps`

A protocol that records no token is priced the way the market prices the
tokens that already trade. For every live-token protocol the snapshot
carries, its FDV/TVL multiple (market cap over TVL) is a comparable.

```
multiple   = median FDV/TVL of the live protocols in this category
             (at least 3 comparables, else the global median), capped at 1.5
base       = tvl_usd x multiple
growth     = clamp(change_7d, -50, +100) per cent
growthMult = 1 + (growth / 100) x 0.35
maturity   = 0.70 + 0.30 x ln(1 + age) / ln(1 + 1095)
implied    = max(1, round(base x growthMult x maturity))
```

No protocol name is ever special-cased: the same function scores every
row, and every number it uses comes from the snapshot itself. The board
ranks all **198** rankable pre-token protocols — the 40 on the house
watchlist plus 158 more below the $50M floor. Live-token protocols are
kept apart and shown at the market's own value, never mixed into the
ranked board.

Each protocol also gets a six-step farm plan, derived from its own record
(category, chains, TVL, age): a fresh wallet, the main position, a second
qualifying action, one action a week, a hold of 30–60 days, and a claim
only from the protocol's own page. Every step states what it costs and
how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

It writes `out/board.json` (the ranked board), `out/data.js` (the
dashboard's data), `out/dashboard/` (the static page), `out/screenshots/`
(three screenshots) and `out/dossier.json` (the judge's dossier, built
with `vendor/makefun-board.ts`). It is deterministic: two runs write the
same bytes.

## Layout

- `main.ts` — the entrypoint: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the model: comparables, implied value, farm plans, board.
- `vendor/makefun-board.ts` — make.fun's dossier library, from the kit.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static page, no
  network, no framework. Deep links: `#detail=<slug>` opens a protocol,
  `#filter=<category>` filters the board.
- `screenshots/` — `1-board.png` (the board), `2-detail.png` (a protocol's
  detail view), `3-filtered.png` (a filtered view).

## Caveats

Implied value is this radar's own claim, from the snapshot's own figures —
not a prediction that a token is issued, or when. A protocol that records
no token may still have one its DefiLlama record does not carry.
