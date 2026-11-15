# Token Radar — pre-token protocols ranked by implied value

A token launch radar. It reads a sealed snapshot of every protocol (DefiLlama's index,
fetched once), ranks the protocols with no token on record by what their launch would be
worth, and writes a web dashboard with the ranking, the reasoning behind each value, and
the steps to farm each protocol.

## The model (radar-2)

A protocol is worth its TVL times the multiple its trading peers already command,
adjusted for seven-day growth and for how long it has run with no token:

```
implied = round(tvl_usd x peer_multiple
              x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
              x (0.6 + min(age_days, 1095) / 1095 x 0.4))
```

`peer_multiple` is the median market-cap-to-TVL ratio of the live-token protocols in the
same category, when at least three of them report both figures; otherwise it is the
market median, clamped to [0.05, 1.50]. It is computed from the snapshot at run time:
no number is carried in from outside, and no protocol name is ever special-cased. A DEX
that trades at 0.34x TVL is worth more per dollar locked than a lender at 0.13x, because
the market already says so.

The board covers the whole watchlist (40 protocols at or above $50M of TVL with no token
on record) plus every other pre-token protocol below the floor the snapshot can rank —
226 rows in all. Live-token protocols are set aside with their market caps shown: their
ratios are the peer evidence the board is priced from.

## The dashboard

- A ranked board with sortable columns (rank, TVL, 7d growth, age, peer multiple, implied
  value), value bars, and a top-pick spotlight.
- Search, category and chain filters, watchlist / early scope, growing-only toggle, and a
  live-token view with each protocol's market-cap-to-TVL ratio.
- A detail view per protocol: the full model breakdown (the page recomputes the row and
  checks the number board.json carries) and a seven-step farm plan with what each step
  costs and how long it takes. Gas follows the main chain: Ethereum costs the most,
  Solana the least, the rest in between.
- A peer-evidence panel (median ratio per category) and a category breakdown of where
  the implied value sits.
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
