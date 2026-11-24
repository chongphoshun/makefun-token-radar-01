# Token Radar v6

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for token launches that have not happened yet. It reads a sealed
snapshot of 758 protocols, prices what each pre-token protocol's token would
be worth if it launched at the going rate for live tokens, ranks the 198 that
can be ranked, and tells the reader whether farming each one is worth the gas.

## What it does

The snapshot carries TVL, seven-day change, market cap where a token already
trades, the listing date, and the chain list for every protocol. The radar
splits the snapshot into live tokens (416 protocols whose record already
carries a token) and pre-token protocols, fits a pricing model on the live
ones, and scores every rankable pre-token protocol three ways: an implied
value (what the token would be worth), a token odds (how often protocols like
this one launch), and an expected value (implied value times odds). Each row
also gets a farm verdict — Farm, Thin, or Skip — and a seven-step farm plan
with the capital, gas, and time each step costs.

## The model, in words

The priced multiple is a market-cap-to-TVL ratio. Its log is fitted by least
squares on the 119 live, non-CEX peers from an intercept, log TVL, seven-day
growth (clamped to −60%…+120%), log of one plus age in days, and one dummy
per large category. The fitted multiple is the exponential of the fitted log
multiple, clamped to 0.02x–1.50x. Implied value is TVL times the multiple.
A single-term size curve (log multiple on log TVL) and a flat median are kept
as comparison methods, not as the price.

Fitted coefficients on 119 live peers, R² 0.2169:

| Term | Coefficient |
| --- | --- |
| Intercept | +9.3257 |
| log TVL | −0.5491 |
| Growth | −2.2710 |
| log1p age | −0.1702 |
| cat: Lending | −0.8018 |
| cat: Dexs | −0.2034 |
| cat: Liquid Staking | −1.1149 |
| cat: RWA | +0.1163 |
| cat: Yield | −0.9913 |

The size curve has intercept 7.7881 and slope −0.5279; the flat median
multiple is 0.246x. The market median multiple is 0.246x as well.

## Conformal interval

Leave-one-out residuals give q90 = 3.5753, so the implied low is the implied
value times exp(−3.5753) and the high times exp(+3.5753). Coverage is 0.899
(107 of 119 residuals inside the interval) against a 90% target — one
protocol short, and the dashboard's self-check says so instead of hiding it.

## Token odds and why they fall with age

Odds come from the 614 protocols that are rankable or live-token. Within each
age band, the live share is shrunk toward the overall launch rate of 0.678
with strength 10, then multiplied by the band's decay. The decay is the
running minimum of the band's still-pre-token share against the youngest
band's, so it can only fall as protocols age.

| Age band | Still pre-token | Decay |
| --- | --- | --- |
| 0–180d | 0.681 | 1.000 |
| 180–365d | 0.517 | 0.759 |
| 365–730d | 0.521 | 0.759 |
| 730–1095d | 0.240 | 0.353 |
| 1095d+ | 0.079 | 0.115 |

Overall decay is 0.474 and the median token odds across the board is 0.420.
Odds fall with age because the longer a protocol runs without a token, the
smaller the share of its age group that is still pre-token: 68.1% of the
youngest band is still waiting, but only 7.9% of the oldest band is. A
protocol that has survived three years without launching is, on this
evidence, unlikely to launch now.

## Held out four ways

Mean absolute log error; lower is better. The multi-term model beats the flat
median in three of the four tests and loses the grouped test, where whole
categories are held out.

| Test | n | Multi | Single | Flat | Category |
| --- | --- | --- | --- | --- | --- |
| Leave-one-out | 119 | 1.6202 | 1.5737 | 1.7715 | 1.9176 |
| Chronological | 27 | 1.2596 | 1.3216 | 1.5234 | 1.7563 |
| Hash split | 28 | 1.4224 | 1.4273 | 1.7965 | 1.8419 |
| Grouped pooled | 26 | 1.8683 | 1.7992 | 1.7218 | 1.7218 |
| Grouped — Lending | 15 | 2.0262 | 1.9400 | 1.8157 | 1.8157 |
| Grouped — Dexs | 11 | 1.6529 | 1.6072 | 1.5937 | 1.5937 |

## Coverage: all 758 accounted for

198 protocols are ranked and 560 are excluded, each for a stated reason:

| Outcome | Count |
| --- | --- |
| Ranked | 198 |
| Live token | 416 |
| CEX | 42 |
| Bridge product | 41 |
| Staked product | 30 |
| Wrapped or staked product | 20 |
| Versioned pool | 11 |

The watchlist is fully covered: 40 of 40.

## Totals and leaders

Total implied value is $2,455,629,876 and total expected value is
$897,737,952. The top category by summed implied value is Risk Curators at
$628,939,635. The largest implied value is Steakhouse Financial at
$71,603,519 (0.026x); the largest expected value is Bittensor dTAO at
$29,994,863.

## Farm verdicts

A farmer puts in capital tiered by TVL ($250 at $5B+, $150 at $1B+, $100 at
$100M+, else $50) for a hold tiered by age (60 days under 180 days old, 45
days under a year, else 30 days), pays first-transaction plus weekly gas for
the protocol's first chain, and expects 10% of the implied value shared
pro-rata by capital over TVL. Farm when that expected value is at least 1.5×
gas, Thin at 1× gas, else Skip. Two assumptions sit behind the verdict: the
airdrop pays 10% of implied value shared pro-rata by capital, and gas costs
the listed first-transaction and weekly rates for the protocol's first chain.
Counts: Farm 18, Thin 19, Skip 161.

## The dashboard

`dashboard/` is a page that renders with no network at all from `data.js`: a
hero with the top three picks by expected value, a KPI strip, a self-check
panel that recomputes its own claims live (including the one check it fails),
an integrity strip tabulating every exclusion reason, search plus category,
chain, scope, verdict and growing filters, pre-token and live-token tabs, a
sortable board (default sort expected value, rank always by implied value), a
live-token table, peer evidence, categories by implied value, the four
validation tests, the odds bands and decay, the full model, and a detail view
per protocol with term contributions, the category-median cross-check, the
expected-value equation, and the seven-step farm plan. Filter and selection
state lives in the URL hash.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

`main.ts` reads the snapshot (a path ending in `.json`, or `snapshot.json`
under a directory), writes `board.json`, `data.js`, and `dossier.json` into
the output directory, and copies `dashboard/` and `screenshots/` there. The
run is deterministic: the same snapshot bytes give the same output bytes.
Node 22.18 or later runs the TypeScript directly.

## Layout

```text
main.ts                  entrypoint: read, score, write
lib/model.ts             snapshot parsing, fit, odds, board, gate
dashboard/index.html     page shell
dashboard/app.js         rendering, filters, detail view
dashboard/app.css        dark-friendly layout
vendor/makefun-board.ts  dossier builder (vendored, untouched)
screenshots/              board, detail, filtered views
```

## License

MIT. See `LICENSE`.

## Disclaimers

Implied value is a model, not a promise: it prices what a token would be
worth if the protocol launched at the going rate for live tokens, and it does
not predict whether or when a token is issued. No token on record is not
proof of no token — a protocol may have a token its record does not carry.
Nothing here is investment advice, and farming costs real gas for an
allocation that may never come.
