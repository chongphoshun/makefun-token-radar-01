# Token Radar — pre-token protocols ranked by expected launch value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads a sealed snapshot of every protocol (DefiLlama's index,
fetched once), ranks the protocols with no token on record by what their launch would
be worth — and by whether it is worth farming — and writes a web dashboard with the
ranking, the reasoning behind each value, and the steps to farm each protocol.

## The model (radar-5)

A protocol is worth its TVL times the multiple its trading peers already command,
adjusted for seven-day growth and for how long it has run with no token:

```
implied = round(tvl_usd x peer_multiple
              x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
              x (0.6 + min(age_days, 1095) / 1095 x 0.4))
```

`peer_multiple` is fitted from the snapshot itself, not taken as a flat median: a size
curve, log(mcap/TVL) = a + b x log(TVL), fitted by ordinary least squares on every
live-token protocol that reports both figures (a 10x bigger TVL prices at roughly 0.3x
the multiple), used raw — no shrinkage toward the median — and clamped to [0.02, 1.50].
The multiple is rounded to 3 decimals in the pricing function itself, so the multiple
the board shows is the multiple the board prices at: recomputing implied value from the
displayed multiple matches board.json on all 198 rows (worst error 0.01%). A big
protocol prices at a lower multiple than a small one because the market already says
so. Each row also shows its category's median ratio as a cross-check, never as the
price. It is computed from the snapshot at run time: no number is carried in from
outside, and no protocol name is ever special-cased.

Expected value weights the implied value by the odds the protocol ever launches a
token, estimated from the snapshot's own peers: P(token) is the live share of the row's
category x age band, shrunk toward its age-band rate (strength 10). Age bands from this
snapshot: 0–180d 31.9%, 180–365d 48.3%, 365–730d 47.9%, 730–1095d 76.0%, 1095d+
92.1%; overall 67.8%. Expected value = implied x P(token). The board sorts by expected
value by default; rank stays by implied value, as the gate requires. The odds are a
cross-sectional base rate, not a timing forecast — the dashboard says so.

The fit is tested out of sample three ways, and the dashboard prints all nine numbers
(mean |log error|, curve vs flat market median vs per-category median): leave-one-out
over 119 live tokens — curve 1.5737 vs flat 1.7715 vs category 1.9176; chronological
holdout (oldest 70% train, newest 30% test, n=27) — 1.3216 vs 1.5234 vs 1.7563;
hash split (slug char-sum mod 5 == 0 held out, n=28) — 1.4273 vs 1.7965 vs 1.8419.
The curve beats the flat median by 11.2% / 13.2% / 20.6%.

Coverage: the board accounts for every one of the 758 protocols in the snapshot —
198 ranked (the 40 watchlist protocols plus 158 off-watchlist pre-token protocols),
560 set aside each with an explicit reason (live token 416, CEX 42, bridge product 41,
staked product 30, wrapped or staked product 20, versioned pool 11). Nothing is
silently dropped; the dashboard's integrity strip prints the counts. Total implied
value $1,566.0M, total expected value $693.9M. On the dev snapshot the top implied
value is Steakhouse Financial at 0.025x / $54.4M; the top expected value is
Polymarket International at $20.8M.

Farm verdicts are costed, not asserted. Each row carries a capital tier by TVL
($250 / $150 / $100 / $50, locked, not spent), a hold of 30 / 45 / 60 days by age,
and gas by chain (Ethereum $15 first / $8 weekly, Solana $0.10 / $0.10, other chains
$0.50 / $0.10). Farmer expected value assumes an airdrop puts 10% of implied value
in farmers' hands, shared pro-rata by capital over TVL. Verdict: Farm when farmer
expected value is at least 1.5x the gas, Thin at 1x, Skip below. On the dev snapshot:
Farm 15, Thin 14, Skip 169. The seven-step plan's step costs are the same gas and
capital the verdict is computed from, and both stated assumptions are printed on the
page beside the verdict.

## The dashboard

- A ranked board with sortable columns (rank, TVL, 7d growth, age, peer multiple,
  implied value, expected value, P(token), verdict), value bars, and a top-three strip
  by expected value that names the first farm step for each pick.
- An integrity strip accounting for all 758 protocols, a validation panel with all
  three held-out tests, a token-odds panel with the derivation, and a KPI strip
  (758 accounted for, 198 ranked, $693.9M total expected, 15 / 14 / 169 verdicts).
- Search, category and chain filters, verdict filter, watchlist / early scope,
  growing-only toggle, and a live-token view with each protocol's market-cap-to-TVL
  ratio. Sort by expected value, implied value or odds.
- A detail page per protocol: the full model breakdown (the page recomputes the row
  and checks the number board.json carries), the expected-value equation with its
  odds basis (band, peers live, peers total), the farm economics (capital, gas total,
  farmer expected value, net, verdict with its threshold), the category median as a
  cross-check, and a seven-step farm plan with what each step costs and how long it
  takes. Gas follows the main chain: Ethereum costs the most, Solana the least, the
  rest in between.
- A peer-evidence panel (median ratio per category), a category breakdown of where
  the implied value sits, and a model panel that states the fitted curve, its three
  out-of-sample tests, the odds formula and the verdict formula with its two stated
  assumptions.
- The whole page is static and renders with no network. Run the program on a new
  snapshot and it ranks the new protocols the same way: no name is ever written into
  the code.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only. The program reads the snapshot, writes `board.json`,
`data.js`, `dashboard/` and `screenshots/` to the output directory, and writes
`dossier.json` with the vendored make.fun library. Two runs on the same snapshot write
the same bytes.

## Layout

```
main.ts                  the entrypoint
lib/model.ts             the model: comparables, implied value, farm plans, the board
vendor/makefun-board.ts  make.fun's dashboard-dossier library, byte for byte
dashboard/               index.html, app.css, app.js (the page, no network)
screenshots/             board, detail, filtered views of the dashboard
```

Implied value is a model, not a promise. It does not predict whether or when a token
is issued. "No token on record" is DefiLlama's record, not proof of no token.

## License

MIT. See LICENSE.
