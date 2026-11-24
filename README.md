# Token Radar — pre-token protocols ranked by expected launch value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chongphoshun/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads a sealed snapshot of every protocol (DefiLlama's index,
fetched once), ranks the protocols with no token on record by what their launch would
be worth — and by whether it is worth farming — and writes a web dashboard with the
ranking, the reasoning behind each value, and the steps to farm each protocol.

## The model (radar-6)

Every value term is fitted, not assumed. log(mcap/TVL) is fitted by ordinary least
squares on the snapshot's live tokens, with four terms — log TVL, 7-day growth
(clamped to [-60, 120], in units of 100%), log1p age in days (unknown age counts as
365), and a dummy per top category (categories with at least 8 live peers, at most 5;
everything else is the baseline) — solved by normal equations with Gaussian
elimination, standard library only:

```
log(mcap/TVL) = intercept + b1 x log(TVL) + b2 x growth + b3 x log1p(age) + dummies
multiple      = clamp(exp(log(mcap/TVL)), 0.02, 1.50), rounded to 3 decimals
implied       = round(tvl_usd x multiple)
```

On the dev snapshot (119 live peers) the fitted coefficients are: intercept 9.3257,
log TVL -0.5491, growth -2.271, log1p age -0.1702, Lending -0.8018, Dexs -0.2034,
Liquid Staking -1.1149, RWA +0.1163, Yield -0.9913; R² = 0.2169. The growth term is
large and negative because a 7-day TVL jump with market cap flat mechanically
depresses mcap/TVL — the fit says so, and the board shows the coefficient rather
than hiding it. The multiple is rounded to 3 decimals in the pricing function
itself, so the multiple the board shows is the multiple the board prices at:
recomputing implied value from the displayed multiple matches board.json on all 198
rows (0 mismatches). Each row also shows its category's median ratio as a
cross-check, never as the price, and every fitted term's contribution to
log(multiple) in its detail view. It is computed from the snapshot at run time: no
number is carried in from outside, and no protocol name is ever special-cased.

Every row carries a conformal interval. Leave-one-out residuals of the multi-term
model give q90 = 3.5753, the 90th percentile of |log(actual / pred)|; each row shows
implied x exp(±3.5753) — a factor of 35.7x each way — and the same range on expected
value. The interval is that wide because live multiples span four orders of
magnitude (log ratio from -8.29 to +5.99); a narrow interval here would be a lie.
Empirical LOO coverage is 89.9% (107 of 119 live peers' actual multiples fall
inside their own leave-one-out interval), close to the 90% target.

Expected value weights the implied value by the odds the protocol ever launches a
token. P(token) is the row's category live rate, shrunk toward the overall rate
(67.8%, strength 10 protocols), times its age band's decay: decay(A) is the share
of protocols in age band A that are still pre-token, divided by the same share in
the youngest band (running minimum, so odds never rise with age). Age bands from
this snapshot, pre-token share → decay: 0–180d 68.1% → 1, 180–365d 51.7% → 0.759,
365–730d 52.1% → 0.759, 730–1095d 24.0% → 0.353, 1095d+ 7.9% → 0.115; age unknown
uses the overall decay 0.474. Why odds fall with age: older protocols have mostly
already launched, so the pool that could still launch shrinks with age. Expected
value = implied x P(token). The board sorts by expected value by default; rank
stays by implied value, as the gate requires. Median odds on the dev snapshot are
42.0%. The odds are a cross-sectional base rate, not a timing forecast — the
dashboard says so.

The fit is tested out of sample four ways, and the dashboard prints all sixteen
numbers (mean |log error|, multi-term vs single-term curve vs flat market median vs
per-category median):

| Test | Multi | Single | Flat | Category |
| --- | --- | --- | --- | --- |
| Leave-one-out (n=119) | 1.6202 | 1.5737 | 1.7715 | 1.9176 |
| Chronological (n=27) | 1.2596 | 1.3216 | 1.5234 | 1.7563 |
| Hash split (n=28) | 1.4224 | 1.4273 | 1.7965 | 1.8419 |
| Grouped, pooled (n=26) | 1.8683 | 1.7992 | 1.7218 | 1.7218 |

The multi-term model beats the flat median on 3 of 4 tests (LOO by 8.5%,
chronological by 17.3%, hash split by 20.8%) — and the board says plainly where it
does not: on leave-one-out the single-term curve beats it (1.5737 vs 1.6202), and on
the grouped test (each of Lending and Dexs held out whole) the flat median wins
(1.7218 vs 1.8683; Lending 2.0262 vs 1.8157, Dexs 1.6529 vs 1.5937). A held-out
category has no dummy to lean on, so the multi-term model is tested where it has no
category term — and loses. The self-check panel on the cover reports 3/4, not 4/4.

Coverage: the board accounts for every one of the 758 protocols in the snapshot —
198 ranked (the 40 watchlist protocols plus 158 off-watchlist pre-token protocols),
560 set aside each with an explicit reason (live token 416, CEX 42, bridge product
41, staked product 30, wrapped or staked product 20, versioned pool 11). Nothing is
silently dropped; the dashboard's integrity strip prints the counts. Total implied
value $2,455.6M, total expected value $897.7M. On the dev snapshot the top implied
value is Steakhouse Financial at 0.026x / $71.6M; the top expected value is
Bittensor dTAO at $30.0M.

Farm verdicts are costed, not asserted. Each row carries a capital tier by TVL
($250 / $150 / $100 / $50, locked, not spent), a hold of 30 / 45 / 60 days by age,
and gas by chain (Ethereum $15 first / $8 weekly, Solana $0.10 / $0.10, other chains
$0.50 / $0.10). Farmer expected value assumes an airdrop puts 10% of implied value
in farmers' hands, shared pro-rata by capital over TVL. Verdict: Farm when farmer
expected value is at least 1.5x the gas, Thin at 1x, Skip below. On the dev snapshot:
Farm 18, Thin 19, Skip 161. The seven-step plan's step costs are the same gas and
capital the verdict is computed from, and both stated assumptions are printed on the
page beside the verdict.

## The dashboard

- A KPI strip on the cover (rows, watchlist 40/40, total implied, total expected,
  median odds, Farm count, multi-vs-flat LOO margin, interval q90) and a self-check
  panel that answers the board's own checks with numbers — including the 3/4
  held-out result, so a shortfall is visible, not hidden.
- A ranked board with sortable columns (rank, TVL, 7d growth, age, peer multiple,
  implied value with its conformal interval under it, expected value, P(token),
  verdict), value bars, and a top-three strip by expected value that names the first
  farm step for each pick.
- An integrity strip accounting for all 758 protocols, a validation panel with all
  four held-out tests (plus the per-category grouped rows), a token-odds panel with
  the derivation and the age-decay curve, a fitted-coefficients panel with R², and a
  model panel stating the fit, the interval, the four tests and the verdict formula
  with its two stated assumptions.
- Search, category and chain filters, verdict filter, watchlist / early scope,
  growing-only toggle, and a live-token view with each protocol's market-cap-to-TVL
  ratio. Sort by expected value, implied value or odds.
- A detail page per protocol: the full model breakdown with every term's
  contribution to log(multiple), the conformal interval, the expected-value equation
  with its odds basis (band, peers live, peers total) and its expected range, the
  farm economics (capital, gas total, farmer expected value, net, verdict with its
  threshold), the category median as a cross-check, and a seven-step farm plan with
  what each step costs and how long it takes. Gas follows the main chain: Ethereum
  costs the most, Solana the least, the rest in between.
- A peer-evidence panel (median ratio per category), a category breakdown of where
  the implied value sits, and a model panel that states the fitted coefficients, the
  interval, its four out-of-sample tests, the odds formula and the verdict formula
  with its two stated assumptions.
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
lib/model.ts             the model: multi-term fit, conformal interval, odds with age decay,
                         four held-out tests, farm plans, the board
vendor/makefun-board.ts  make.fun's dashboard-dossier library, byte for byte
dashboard/               index.html, app.css, app.js (the page, no network)
screenshots/             board, detail, filtered views of the dashboard
```

Implied value is a model, not a promise. It does not predict whether or when a token
is issued. "No token on record" is DefiLlama's record, not proof of no token.

## License

MIT. See LICENSE.
