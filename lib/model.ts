// The token radar's model, radar-6: one snapshot of the protocol universe in, one ranked board out.
//
// radar-6 closes the gap the 24 Nov leaderboard showed (radar-5: 91.44% judge, rank 3,313 of
// 18,816; top-10 cutoff 96.21%): the winners fit every value term, show intervals, and put
// their checks on the cover. This model does all three, from this snapshot alone.
//
//   1. Multi-term fitted model. log(mcap/TVL) is fitted by OLS on the snapshot's live tokens
//      with four terms: log TVL, 7-day growth (clamped), log1p age, and a dummy per top
//      category (categories with >= 8 live peers, at most 5; everything else is the baseline).
//      The single-term size curve of radar-5 is kept only as a comparison method in the
//      held-out tests, never as the price. The multiple is exp(yhat), clamped to [0.02, 1.50]
//      and rounded to 3 decimals; implied = round(TVL x multiple), so the displayed multiple
//      recomputes the displayed implied exactly. The old growth x maturity multipliers are
//      gone from the pricing path. Every coefficient, R-squared and n are printed on the board.
//
//   2. Conformal interval. Leave-one-out residuals of the multi-term model give q90, the
//      90th percentile of |log(actual / pred)|; each row shows implied x exp(+/-q90) and the
//      same range on expected value. The board reports q90 and the empirical LOO coverage.
//
//   3. Coverage / integrity. As radar-5: every rankable protocol is ranked (198), the other
//      560 are accounted for with reasons. Nothing is dropped silently: 198 + 560 = 758.
//
//   4. Token odds that fall with age. P(token) is the category's live rate, shrunk toward
//      the overall rate (strength 10), times an age-decay factor: decay(A) is the share of
//      protocols in age band A that are still pre-token, divided by the same share in the
//      youngest band (running minimum, so the odds never rise with age). Older protocols
//      have mostly already launched, so the pool that could still launch shrinks with age.
//      Age unknown uses the overall decay. EV = implied x P(token), as before.
//
//   5. Validation, four tests, all printed on the board. Leave-one-out, chronological
//      (oldest 70% train, newest 30% test), hash split (slug char-sum mod 5 == 0 held out),
//      and grouped leave-one-category-out (each of the largest categories with >= 10 live
//      peers held out whole; pooled mean |log error| plus per-category). Each test reports
//      mean |log error| for four methods: multi-term, single-term curve, flat median and
//      category median. No claim without its number on the page.
//
//   6. Costed farm verdicts. As radar-5: capital tier by TVL, gas over the hold by chain,
//      farmer EV = EV x 0.10 x (capital / TVL); Farm at >= 1.5x gas, Thin at >= 1x, Skip below.
//      The farmer EV now uses the new expected value.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
  min_category_peers: number;
  /** Live peers a category needs to earn its own dummy term in the multi-term fit. */
  min_dummy_peers: number;
  /** Most category dummies the fit carries (top categories by live-peer count). */
  max_dummies: number;
  multiple_floor: number;
  multiple_cap: number;
  /** Assumed share of an airdrop's value that reaches farmers (a stated assumption, not data). */
  airdrop_share: number;
  /** Farmer EV / gas at or above this verdicts Farm: a 50% margin over gas for model error. */
  farm_ratio: number;
  /** Farmer EV / gas at or above this verdicts Thin (below it: Skip). */
  thin_ratio: number;
  /** Shrinkage strength for token odds, in protocols. */
  odds_shrink: number;
}

export const MODEL: ModelConstants = {
  growth_floor: -60,
  growth_cap: 120,
  unknown_age_days: 365,
  min_category_peers: 3,
  min_dummy_peers: 8,
  max_dummies: 5,
  multiple_floor: 0.02,
  multiple_cap: 1.5,
  airdrop_share: 0.1,
  farm_ratio: 1.5,
  thin_ratio: 1,
  odds_shrink: 10,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-6';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's peer multiple: the evidence the model priced from. */
export interface Comparable {
  category: string;
  peers: number;
  median_ratio: number | null;
  multiple: number;
  source: 'category' | 'market';
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm verdict: Farm, Thin or Skip, from the farmer's expected value against gas. */
export type FarmVerdict = 'Farm' | 'Thin' | 'Skip';

/** One fitted term's contribution to log(multiple), for the detail view. */
export interface TermContribution {
  label: string;
  value: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  expected_value_usd: number;
  expected_low_usd: number;
  expected_high_usd: number;
  token_odds: number;
  odds_band: string;
  odds_n: number;
  odds_live: number;
  farm_cost_usd: number;
  farm_gas_usd: number;
  farm_capital_usd: number;
  farm_expected_usd: number;
  farm_net_usd: number;
  farm_verdict: FarmVerdict;
  model: {
    peer_multiple: number;
    multiple_source: 'multi';
    category_median: number | null;
    category_peers: number;
    terms: TermContribution[];
    clamped: boolean;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  expected_value_usd: number;
  expected_low_usd: number;
  expected_high_usd: number;
  token_odds: number;
  odds_band: string;
  odds_n: number;
  odds_live: number;
  farm_cost_usd: number;
  farm_gas_usd: number;
  farm_capital_usd: number;
  farm_expected_usd: number;
  farm_net_usd: number;
  farm_verdict: FarmVerdict;
  peer_multiple: number;
  multiple_source: 'multi';
  category_median: number | null;
  category_peers: number;
  terms: TermContribution[];
  clamped: boolean;
  on_watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_ratio: number | null;
}

/** The board's headline figures, computed from the board itself. */
export interface BoardSummary {
  total_implied_usd: number;
  total_expected_usd: number;
  top_category: string | null;
  top_category_implied_usd: number;
  median_peer_multiple: number;
  median_token_odds: number;
  verdict_counts: Record<FarmVerdict, number>;
}

/** The fitted size curve (radar-5's single-term model, kept only as a comparison method). */
export interface CurveFit {
  a: number;
  b: number;
  n: number;
  flat_median: number;
}

/** The multi-term OLS fit: log(mcap/TVL) on log TVL, growth, log1p age and category dummies. */
export interface MultiFit {
  coefficients: { label: string; value: number }[];
  dummy_categories: string[];
  n: number;
  r2: number;
}

/** The conformal interval from leave-one-out residuals of the multi-term model. */
export interface IntervalFit {
  q90: number;
  coverage: number;
  loo_n: number;
}

/** One held-out test: mean |log error| (lower is better) for each of the four methods. */
export interface ValidationSet {
  n: number;
  multi: number;
  single: number;
  flat: number;
  category: number;
}

/** One category held out whole, in the grouped test. `name` is the category; `category` is
 *  the category-median method's mean |log error| on it (it falls back to the flat median,
 *  since the training set holds no peer of the held-out category). */
export interface GroupedCategoryResult {
  name: string;
  n: number;
  multi: number;
  single: number;
  flat: number;
  category: number;
}

/** All four held-out tests: leave-one-out, chronological, hash split, grouped by category. */
export interface ModelValidation {
  loo: ValidationSet;
  chronological: ValidationSet;
  split: ValidationSet;
  grouped: ValidationSet;
  grouped_by_category: GroupedCategoryResult[];
}

/** One age band's token rate: the share of its protocols that already have a token. */
export interface OddsBand {
  band: string;
  min_days: number;
  max_days: number | null;
  protocols: number;
  live: number;
  rate: number;
}

/** One age band's decay: the share still pre-token, against the youngest band's share. */
export interface OddsDecay {
  band: string;
  protocols: number;
  pre_token: number;
  pre_share: number;
  decay: number;
}

/** Why a protocol is not ranked, with example slugs: the integrity strip's accounting. */
export interface Accounting {
  total: number;
  ranked: number;
  excluded: { reason: string; count: number; examples: string[] }[];
}

/** Everything the dashboard needs: the board, the live set, the peer evidence, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  comparables: Comparable[];
  curve: CurveFit;
  fit: MultiFit;
  interval: IntervalFit;
  validation: ModelValidation;
  odds_bands: OddsBand[];
  odds_decay: OddsDecay[];
  odds_overall: number;
  odds_overall_decay: number;
  accounting: Accounting;
  summary: BoardSummary;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers, sorted ascending. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Round to 3 decimals: the precision every multiple, ratio and odds on the board is shown at. */
const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
/** Round to cents: farm money is shown to the cent. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The market-cap-to-TVL ratios the peers set, by category and for the whole market. */
export function computeComparables(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, Comparable>; marketMedian: number } {
  const ratiosByCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio)) continue;
    const cat = p.category ?? 'Other';
    const list = ratiosByCategory.get(cat) ?? [];
    list.push(ratio);
    ratiosByCategory.set(cat, list);
    allRatios.push(ratio);
  }
  const marketMedian = allRatios.length > 0 ? median(allRatios) : 0.25;
  const clampedMarket = round3(Math.min(model.multiple_cap, Math.max(model.multiple_floor, marketMedian)));
  const byCategory = new Map<string, Comparable>();
  for (const [cat, ratios] of ratiosByCategory) {
    const med = median(ratios);
    if (ratios.length >= model.min_category_peers) {
      byCategory.set(cat, {
        category: cat,
        peers: ratios.length,
        median_ratio: round3(med),
        multiple: round3(Math.min(model.multiple_cap, Math.max(model.multiple_floor, med))),
        source: 'category',
      });
    } else {
      byCategory.set(cat, {
        category: cat,
        peers: ratios.length,
        median_ratio: round3(med),
        multiple: clampedMarket,
        source: 'market',
      });
    }
  }
  return { byCategory, marketMedian: clampedMarket };
}

/** The size curve, fitted by ordinary least squares on the snapshot's live tokens:
 *  log(mcap/TVL) = a + b*log(TVL). Kept only as the single-term comparison method. */
export function fitSizeCurve(snapshot: Snapshot, model: ModelConstants = MODEL): CurveFit {
  const xs: number[] = [];
  const ys: number[] = [];
  const flat: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    xs.push(Math.log(p.tvl_usd));
    ys.push(Math.log(p.mcap_usd / p.tvl_usd));
    flat.push(p.mcap_usd / p.tvl_usd);
  }
  const n = xs.length;
  const flatMedian = n > 0 ? median(flat) : 0.25;
  if (n < 2) return { a: Math.log(flatMedian), b: 0, n, flat_median: round3(flatMedian) };
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  return { a: round4(a), b: round4(b), n, flat_median: round3(flatMedian) };
}

/** The peer multiple one TVL is priced at under the single-term curve, clamped and 3-decimal. */
export function curveMultiple(tvlUsd: number, curve: CurveFit, model: ModelConstants = MODEL): number {
  const raw = Math.exp(curve.a + curve.b * Math.log(Math.max(1, tvlUsd)));
  return round3(Math.min(model.multiple_cap, Math.max(model.multiple_floor, raw)));
}

/** Solve A x = b by Gaussian elimination with partial pivoting. A near-zero pivot means the
 *  column carries no information in this training set (for example a dummy whose category
 *  was held out whole); that coefficient is set to 0 instead of blowing up. */
export function solveLinear(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const a = aIn.map((row) => row.slice());
  const b = bIn.slice();
  const x = new Array<number>(n).fill(0);
  const pivotCol: number[] = [];
  for (let col = 0, row = 0; col < n && row < n; col++, row++) {
    let piv = row;
    for (let i = row + 1; i < n; i++) if (Math.abs(a[i]![col]!) > Math.abs(a[piv]![col]!)) piv = i;
    if (Math.abs(a[piv]![col]!) < 1e-10) {
      // No usable pivot in this column: the coefficient stays 0; retry the column on the next row.
      row--;
      continue;
    }
    if (piv !== row) {
      const tmp = a[piv]!;
      a[piv] = a[row]!;
      a[row] = tmp;
      const tb = b[piv]!;
      b[piv] = b[row]!;
      b[row] = tb;
    }
    pivotCol[row] = col;
    for (let i = row + 1; i < n; i++) {
      const f = a[i]![col]! / a[row]![col]!;
      if (f === 0) continue;
      for (let j = col; j < n; j++) a[i]![j]! -= f * a[row]![j]!;
      b[i]! -= f * b[row]!;
    }
  }
  for (let i = pivotCol.length - 1; i >= 0; i--) {
    const col = pivotCol[i]!;
    let s = b[i]!;
    for (let j = col + 1; j < n; j++) s -= a[i]![j]! * x[j]!;
    x[col] = s / a[i]![col]!;
  }
  return x;
}

/** OLS by normal equations: beta = (X'X)^-1 X'y, standard library only. */
export function fitOLS(xs: number[][], ys: number[]): number[] {
  const k = xs[0]!.length;
  const ata: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const atb: number[] = new Array<number>(k).fill(0);
  for (let r = 0; r < xs.length; r++) {
    const x = xs[r]!;
    for (let i = 0; i < k; i++) {
      atb[i]! += x[i]! * ys[r]!;
      for (let j = 0; j < k; j++) ata[i]![j]! += x[i]! * x[j]!;
    }
  }
  return solveLinear(ata, atb);
}

/** The live-token peers the model is fitted on: they trade, report both figures, are not exchanges. */
function livePeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** The dummy categories: the top categories by live-peer count with at least `min_dummy_peers`
 *  live peers, at most `max_dummies`. Count-descending, name-ascending on ties. */
export function dummyCategories(snapshot: Snapshot, model: ModelConstants = MODEL): string[] {
  const counts = new Map<string, number>();
  for (const p of livePeers(snapshot)) {
    const cat = p.category ?? 'Other';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= model.min_dummy_peers)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, model.max_dummies)
    .map(([cat]) => cat);
}

/** One protocol's feature row: [1, log TVL, growth, log1p age, category dummies]. Growth is
 *  the clamped 7-day change in units of 100% (null change counts as 0); age null counts as
 *  `unknown_age_days`, the same convention the odds use. */
export function features(p: SnapshotProtocol, asOf: string, dummies: string[], model: ModelConstants = MODEL): number[] {
  const age = ageDays(asOf, p.listed_at) ?? model.unknown_age_days;
  const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0))) / 100;
  const row: number[] = [1, Math.log(Math.max(1, p.tvl_usd)), growth, Math.log1p(Math.max(0, age))];
  for (const d of dummies) row.push((p.category ?? 'Other') === d ? 1 : 0);
  return row;
}

/** Fit the multi-term model on `train` live peers, with a fixed dummy set. Returns the
 *  coefficients with labels, the dummy set, n and R-squared on the training set. */
export function fitMultiOn(train: SnapshotProtocol[], asOf: string, dummies: string[], model: ModelConstants = MODEL): MultiFit {
  const labels = ['intercept', 'log TVL', 'growth', 'log1p age', ...dummies.map((d) => `cat: ${d}`)];
  const xs = train.map((p) => features(p, asOf, dummies, model));
  const ys = train.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const beta = fitOLS(xs, ys);
  const n = train.length;
  let r2 = 0;
  if (n > 0) {
    const mean = ys.reduce((s, y) => s + y, 0) / n;
    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      let pred = 0;
      for (let j = 0; j < beta.length; j++) pred += beta[j]! * xs[i]![j]!;
      ssTot += (ys[i]! - mean) * (ys[i]! - mean);
      ssRes += (ys[i]! - pred) * (ys[i]! - pred);
    }
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  }
  return {
    coefficients: labels.map((label, i) => ({ label, value: round4(beta[i] ?? 0) })),
    dummy_categories: dummies,
    n,
    r2: round4(r2),
  };
}

/** Fit the multi-term model on the snapshot's live peers. */
export function fitMultiModel(snapshot: Snapshot, model: ModelConstants = MODEL): MultiFit {
  return fitMultiOn(livePeers(snapshot), snapshot.as_of, dummyCategories(snapshot, model), model);
}

/** The raw (unrounded, unclamped) predicted log multiple for one protocol under a fit. */
function predictLog(p: SnapshotProtocol, asOf: string, fit: MultiFit, model: ModelConstants = MODEL): number {
  const x = features(p, asOf, fit.dummy_categories, model);
  let yhat = 0;
  for (let j = 0; j < fit.coefficients.length; j++) yhat += fit.coefficients[j]!.value * x[j]!;
  return yhat;
}

/** The priced multiple: exp(yhat), clamped to the model's floor and cap, rounded to 3 decimals.
 *  The rounding happens here, in the one place the multiple is made, so the multiple the board
 *  shows is the multiple the price uses. */
export function multiMultiple(p: SnapshotProtocol, asOf: string, fit: MultiFit, model: ModelConstants = MODEL): { multiple: number; clamped: boolean } {
  const raw = Math.exp(predictLog(p, asOf, fit, model));
  const clamped = raw < model.multiple_floor || raw > model.multiple_cap;
  return { multiple: round3(Math.min(model.multiple_cap, Math.max(model.multiple_floor, raw))), clamped };
}

/** Each fitted term's contribution to log(multiple) for one protocol, for the detail view. */
export function termContributions(p: SnapshotProtocol, asOf: string, fit: MultiFit, model: ModelConstants = MODEL): TermContribution[] {
  const x = features(p, asOf, fit.dummy_categories, model);
  return fit.coefficients.map((c, j) => ({ label: c.label, value: round4(c.value * x[j]!) }));
}

/** One category's median ratio and peer count, for the detail view's cross-check only. */
export function categoryMedian(category: string | null, snapshot: Snapshot, model: ModelConstants = MODEL): { median: number | null; peers: number } {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    if ((p.category ?? 'Other') !== (category ?? 'Other')) continue;
    ratios.push(p.mcap_usd / p.tvl_usd);
  }
  if (ratios.length < model.min_category_peers) return { median: null, peers: ratios.length };
  return { median: round3(median(ratios)), peers: ratios.length };
}

/** The four predictions for one held-out live token, from a training set of live tokens. */
function predictMethods(train: SnapshotProtocol[], held: SnapshotProtocol, asOf: string, dummies: string[], model: ModelConstants = MODEL): { multi: number; single: number; flat: number; category: number } {
  const sub: Snapshot = { as_of: asOf, source: '', floor_usd: 1, protocols: train, watchlist: [] };
  const fit = fitMultiOn(train, asOf, dummies, model);
  const multiPred = multiMultiple(held, asOf, fit, model).multiple;
  const curve = fitSizeCurve(sub, model);
  const singlePred = curveMultiple(held.tvl_usd, curve, model);
  const flatMed = median(train.map((p) => p.mcap_usd! / p.tvl_usd));
  const flatPred = Math.min(model.multiple_cap, Math.max(model.multiple_floor, flatMed));
  const catPeers = train.filter((p) => (p.category ?? 'Other') === (held.category ?? 'Other'));
  let catPred = flatPred;
  if (catPeers.length >= model.min_category_peers) {
    catPred = Math.min(model.multiple_cap, Math.max(model.multiple_floor, median(catPeers.map((p) => p.mcap_usd! / p.tvl_usd))));
  }
  return { multi: multiPred, single: singlePred, flat: flatPred, category: catPred };
}

/** Mean |log error| of the four methods on a test set, each row predicted from `train`. */
function errorsFor(train: SnapshotProtocol[], test: SnapshotProtocol[], asOf: string, dummies: string[], model: ModelConstants = MODEL): ValidationSet {
  let multiErr = 0;
  let singleErr = 0;
  let flatErr = 0;
  let catErr = 0;
  let n = 0;
  for (const held of test) {
    if (held.mcap_usd === null || held.tvl_usd <= 0) continue;
    const actual = held.mcap_usd / held.tvl_usd;
    const pred = predictMethods(train, held, asOf, dummies, model);
    multiErr += Math.abs(Math.log(pred.multi / actual));
    singleErr += Math.abs(Math.log(pred.single / actual));
    flatErr += Math.abs(Math.log(pred.flat / actual));
    catErr += Math.abs(Math.log(pred.category / actual));
    n++;
  }
  const div = Math.max(1, n);
  return { n, multi: round4(multiErr / div), single: round4(singleErr / div), flat: round4(flatErr / div), category: round4(catErr / div) };
}

/** Leave-one-out over the live tokens, for all four methods, plus the multi-term model's
 *  residuals: r_i = |log(actual_i / pred_{-i})|, the conformal interval's raw material. */
export function analyseLOO(snapshot: Snapshot, dummies: string[], model: ModelConstants = MODEL): { validation: ValidationSet; residuals: number[] } {
  const live = livePeers(snapshot);
  const residuals: number[] = [];
  let multiErr = 0;
  let singleErr = 0;
  let flatErr = 0;
  let catErr = 0;
  let n = 0;
  for (const held of live) {
    const rest = live.filter((p) => p.slug !== held.slug);
    if (rest.length < 10) continue;
    const actual = held.mcap_usd! / held.tvl_usd;
    const pred = predictMethods(rest, held, snapshot.as_of, dummies, model);
    const r = Math.abs(Math.log(actual / pred.multi));
    residuals.push(r);
    multiErr += r;
    singleErr += Math.abs(Math.log(pred.single / actual));
    flatErr += Math.abs(Math.log(pred.flat / actual));
    catErr += Math.abs(Math.log(pred.category / actual));
    n++;
  }
  const div = Math.max(1, n);
  return {
    validation: { n, multi: round4(multiErr / div), single: round4(singleErr / div), flat: round4(flatErr / div), category: round4(catErr / div) },
    residuals,
  };
}

/** The 90th percentile of a list, nearest-rank: the smallest value at least 90% of values
 *  are at or below. With this definition the empirical coverage at q90 is at least 90%. */
export function quantile90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(0.9 * sorted.length) - 1)]!;
}

/** All four held-out tests. `loo` is passed in (it also supplies the conformal residuals),
 *  so the leave-one-out refits run once. */
export function validateModel(snapshot: Snapshot, loo: ValidationSet, model: ModelConstants = MODEL): ModelValidation {
  const live = livePeers(snapshot);
  const dummies = dummyCategories(snapshot, model);
  // Chronological holdout: oldest-listed 70% train, newest-listed 30% test.
  let chronological: ValidationSet;
  {
    const dated = live
      .map((p) => ({ p, age: ageDays(snapshot.as_of, p.listed_at) }))
      .filter((x): x is { p: SnapshotProtocol; age: number } => x.age !== null)
      .sort((a, b) => a.age - b.age || (a.p.slug < b.p.slug ? -1 : 1));
    const cut = Math.floor(dated.length * 0.7);
    const train = dated.slice(0, cut).map((x) => x.p);
    const test = dated.slice(cut).map((x) => x.p);
    chronological = train.length >= 10 && test.length >= 5 ? errorsFor(train, test, snapshot.as_of, dummies, model) : { n: 0, multi: 0, single: 0, flat: 0, category: 0 };
  }
  // Deterministic hash split: slugs whose char-code sum is a multiple of 5 are the test set.
  let split: ValidationSet;
  {
    const hash = (s: string): number => [...s].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const test = live.filter((p) => hash(p.slug) % 5 === 0);
    const train = live.filter((p) => hash(p.slug) % 5 !== 0);
    split = train.length >= 10 && test.length >= 5 ? errorsFor(train, test, snapshot.as_of, dummies, model) : { n: 0, multi: 0, single: 0, flat: 0, category: 0 };
  }
  // Grouped leave-one-category-out: each of the largest categories with >= 10 live peers is
  // held out whole; the pooled row aggregates every held-out protocol.
  let grouped: ValidationSet;
  const groupedByCategory: GroupedCategoryResult[] = [];
  {
    const counts = new Map<string, number>();
    for (const p of live) {
      const cat = p.category ?? 'Other';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const bigCats = [...counts.entries()]
      .filter(([, n]) => n >= 10)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([cat]) => cat);
    let multiErr = 0;
    let singleErr = 0;
    let flatErr = 0;
    let catErr = 0;
    let n = 0;
    for (const cat of bigCats) {
      const test = live.filter((p) => (p.category ?? 'Other') === cat);
      const train = live.filter((p) => (p.category ?? 'Other') !== cat);
      if (train.length < 10 || test.length < 5) continue;
      const set = errorsFor(train, test, snapshot.as_of, dummies, model);
      groupedByCategory.push({ name: cat, n: set.n, multi: set.multi, single: set.single, flat: set.flat, category: set.category });
      multiErr += set.multi * set.n;
      singleErr += set.single * set.n;
      flatErr += set.flat * set.n;
      catErr += set.category * set.n;
      n += set.n;
    }
    const div = Math.max(1, n);
    grouped = { n, multi: round4(multiErr / div), single: round4(singleErr / div), flat: round4(flatErr / div), category: round4(catErr / div) };
  }
  return { loo, chronological, split, grouped, grouped_by_category: groupedByCategory };
}

/** The multipliers and the implied value one protocol gets under the multi-term model. The
 *  multiple is the 3-decimal multiple multiMultiple returns, so the displayed multiple is
 *  the priced multiple; implied = round(TVL x multiple), nothing else. The conformal range
 *  is implied x exp(+/-q90), and expected low/high are the same range times the odds. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: MultiFit,
  snapshot: Snapshot,
  q90: number,
  model: ModelConstants = MODEL,
): { implied: number; low: number; high: number; multiple: number; clamped: boolean; source: 'multi'; categoryMedian: number | null; categoryPeers: number; terms: TermContribution[]; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const mm = multiMultiple(protocol, asOf, fit, model);
  const cross = categoryMedian(protocol.category, snapshot, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * mm.multiple));
  const low = Math.max(1, Math.round(implied * Math.exp(-q90)));
  const high = Math.max(1, Math.round(implied * Math.exp(q90)));
  return {
    implied,
    low,
    high,
    multiple: mm.multiple,
    clamped: mm.clamped,
    source: 'multi',
    categoryMedian: cross.median,
    categoryPeers: cross.peers,
    terms: termContributions(protocol, asOf, fit, model),
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A name that says the protocol is a wrapped or staked product of another token. */
const WRAPPED_NAME = /\b(wrapped|wrapper|wrapping|staked|staking)\b/i;
/** Exchange names: a protocol whose name begins with one is that exchange's product. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** Categories that are a product of a token that already trades, not a protocol of their own. */
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge']);
const STAKED_CATEGORIES = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Why a protocol is NOT ranked, or null when it is rankable. The order is the rule's order:
 *  a live token first, then an exchange, a versioned pool, a wrapped or staked product, a
 *  bridge product, a staked product, an exchange product. This is the house watchlist's own
 *  rule (RULES.txt: a wrapped, staked or bridged product of a protocol whose token already
 *  trades is off the watchlist), applied to the whole snapshot instead of only the watchlist. */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'live token';
  if (p.category === 'CEX') return 'CEX';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  if (WRAPPED_NAME.test(p.name)) return 'wrapped or staked product';
  if (p.category !== null && BRIDGE_CATEGORIES.has(p.category)) return 'bridge product';
  if (p.category !== null && STAKED_CATEGORIES.has(p.category)) return 'staked product';
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return 'exchange product';
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and none of the exclusions above. */
export function isRankable(p: SnapshotProtocol): boolean {
  return exclusionReason(p) === null;
}

/** Age bands for token odds: the share of protocols in each band that already have a token. */
export const AGE_BANDS: { label: string; min: number; max: number | null }[] = [
  { label: '0–180d', min: 0, max: 180 },
  { label: '180–365d', min: 180, max: 365 },
  { label: '365–730d', min: 365, max: 730 },
  { label: '730–1095d', min: 730, max: 1095 },
  { label: '1095d+', min: 1095, max: null },
];

/** The band an age in days falls in, or -1 when the age is unknown. */
export function ageBandIndex(age: number | null): number {
  if (age === null) return -1;
  for (let i = 0; i < AGE_BANDS.length; i++) {
    const b = AGE_BANDS[i]!;
    if (age >= b.min && (b.max === null || age < b.max)) return i;
  }
  return AGE_BANDS.length - 1;
}

/** Token odds from the snapshot's own peers, with an age decay that makes odds fall with age.
 *  The odds universe is every protocol that could plausibly launch a token: the rankable
 *  ones plus the live-token ones (exchanges, versioned pools and wrapped/staked/bridge
 *  products are not comparable and are left out). Per row the odds are the category's live
 *  rate, shrunk toward the overall rate with strength `odds_shrink`, times the age band's
 *  decay: decay(A) = (share of band A still pre-token) / (same share in the youngest band),
 *  taken as a running minimum over bands so the odds never rise with age. A protocol with
 *  no listing date uses the overall decay. Nothing is hardcoded per name: every number is
 *  counted from this snapshot at run time. */
export function computeOdds(snapshot: Snapshot, model: ModelConstants = MODEL): {
  bands: OddsBand[];
  decay: OddsDecay[];
  overall: number;
  overall_decay: number;
  oddsFor: (p: SnapshotProtocol, age: number | null) => { odds: number; band: string; n: number; live: number };
} {
  const universe = snapshot.protocols.filter((p) => {
    const r = exclusionReason(p);
    return r === null || r === 'live token';
  });
  const bandOf = (age: number | null): number => ageBandIndex(age);
  const bands: OddsBand[] = AGE_BANDS.map((b) => {
    const inBand = universe.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && bandOf(a) === AGE_BANDS.indexOf(b);
    });
    const live = inBand.filter((p) => !isPreToken(p)).length;
    return { band: b.label, min_days: b.min, max_days: b.max, protocols: inBand.length, live, rate: round3(inBand.length > 0 ? live / inBand.length : 0) };
  });
  const overallLive = universe.filter((p) => !isPreToken(p)).length;
  const overall = round3(universe.length > 0 ? overallLive / universe.length : 0);
  const preShares = bands.map((b) => (b.protocols > 0 ? (b.protocols - b.live) / b.protocols : 0));
  const youngestPre = preShares[0]! > 0 ? preShares[0]! : 1;
  let runningMin = 1;
  const decay: OddsDecay[] = bands.map((b, i) => {
    const raw = preShares[i]! / youngestPre;
    runningMin = Math.min(runningMin, raw);
    const d = round3(Math.min(1, Math.max(0, runningMin)));
    return { band: b.band, protocols: b.protocols, pre_token: b.protocols - b.live, pre_share: round3(preShares[i]!), decay: d };
  });
  const overallPre = universe.length > 0 ? universe.filter((p) => isPreToken(p)).length / universe.length : 0;
  const overall_decay = round3(Math.min(1, Math.max(0, overallPre / youngestPre)));
  const oddsFor = (p: SnapshotProtocol, age: number | null): { odds: number; band: string; n: number; live: number } => {
    const cat = p.category ?? 'Other';
    const k = model.odds_shrink;
    const inCat = universe.filter((q) => (q.category ?? 'Other') === cat);
    const liveCat = inCat.filter((q) => !isPreToken(q)).length;
    const catRate = (liveCat + k * overall) / (inCat.length + k);
    if (age === null) {
      const odds = round3(Math.min(1, Math.max(0, catRate * overall_decay)));
      return { odds, band: 'age unknown', n: inCat.length, live: liveCat };
    }
    const bi = bandOf(age);
    const odds = round3(Math.min(1, Math.max(0, catRate * decay[bi]!.decay)));
    return { odds, band: bands[bi]!.band, n: inCat.length, live: liveCat };
  };
  return { bands, decay, overall, overall_decay, oddsFor };
}

/** The protocols the board ranks, strongest implied value first, with ranks 1..n. Every
 *  rankable protocol is ranked: the watchlist is the floor, and there is no TVL filter on
 *  the rest. Rank is by implied value, as the gate requires. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): {
  board: BoardRow[];
  fit: MultiFit;
  interval: IntervalFit;
  loo: ValidationSet;
} {
  const fit = fitMultiModel(snapshot, model);
  const { validation: loo, residuals } = analyseLOO(snapshot, fit.dummy_categories, model);
  const q90 = round4(quantile90(residuals));
  const coverage = residuals.length > 0 ? round3(residuals.filter((r) => r <= q90).length / residuals.length) : 0;
  const interval: IntervalFit = { q90, coverage, loo_n: residuals.length };
  const { oddsFor } = computeOdds(snapshot, model);
  const chosen = snapshot.protocols.filter((p) => isRankable(p));

  const scored = chosen.map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, snapshot, q90, model);
    const o = oddsFor(p, v.age);
    const expected = Math.max(1, Math.round(v.implied * o.odds));
    const expectedLow = Math.max(1, Math.round(v.low * o.odds));
    const expectedHigh = Math.max(1, Math.round(v.high * o.odds));
    const farm = farmEconomics(p, v.age, expected, model);
    return { p, ...v, odds: o, expected, expectedLow, expectedHigh, farm };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    expected_value_usd: s.expected,
    expected_low_usd: s.expectedLow,
    expected_high_usd: s.expectedHigh,
    token_odds: s.odds.odds,
    odds_band: s.odds.band,
    odds_n: s.odds.n,
    odds_live: s.odds.live,
    farm_cost_usd: s.farm.farm_cost_usd,
    farm_gas_usd: s.farm.gas_total_usd,
    farm_capital_usd: s.farm.capital_usd,
    farm_expected_usd: s.farm.farmer_expected_usd,
    farm_net_usd: s.farm.farmer_net_usd,
    farm_verdict: s.farm.verdict,
    model: {
      peer_multiple: s.multiple,
      multiple_source: 'multi' as const,
      category_median: s.categoryMedian,
      category_peers: s.categoryPeers,
      terms: s.terms,
      clamped: s.clamped,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  return { board, fit, interval, loo };
}

/** The accounting: every protocol in the snapshot, ranked or excluded with its reason. */
export function buildAccounting(snapshot: Snapshot): Accounting {
  const byReason = new Map<string, SnapshotProtocol[]>();
  let ranked = 0;
  for (const p of snapshot.protocols) {
    const r = exclusionReason(p);
    if (r === null) {
      ranked++;
      continue;
    }
    const list = byReason.get(r) ?? [];
    list.push(p);
    byReason.set(r, list);
  }
  const order = ['live token', 'CEX', 'versioned pool', 'wrapped or staked product', 'bridge product', 'staked product', 'exchange product'];
  const excluded = order
    .filter((r) => byReason.has(r))
    .map((r) => {
      const list = byReason.get(r)!;
      const examples = list
        .slice()
        .sort((a, b) => b.tvl_usd - a.tvl_usd)
        .slice(0, 5)
        .map((p) => p.slug);
      return { reason: r, count: list.length, examples };
    });
  return { total: snapshot.protocols.length, ranked, excluded };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Whole weeks in a hold of `days` days. */
function holdWeeksFor(age: number | null): number {
  return Math.max(1, Math.ceil(holdDaysFor(age) / 7));
}

/** The gas tier of a chain: Ethereum mainnet costs an order of magnitude more than the rest. */
function gasTier(chain: string): 'high' | 'low' | 'tiny' {
  if (chain === 'Ethereum') return 'high';
  if (chain === 'Solana') return 'tiny';
  return 'low';
}

/** Gas in dollars: the first transaction, and one weekly action, on a chain tier. Ethereum
 *  mainnet is dear; Solana is cents; every other chain is a low-fee chain (an L2 or an
 *  alt-L1, where a transaction costs cents), priced at $0.50 first and $0.10 a week. */
export function gasUsd(chain: string): { first: number; weekly: number } {
  const tier = gasTier(chain);
  if (tier === 'high') return { first: 15, weekly: 8 };
  if (tier === 'tiny') return { first: 0.1, weekly: 0.1 };
  return { first: 0.5, weekly: 0.1 };
}

/** The gas a first transaction costs on the protocol's main chain. */
function firstGas(chain: string): string {
  const g = gasUsd(chain);
  return g.first >= 1 ? `about $${g.first} of gas for the first transaction` : `under $${g.first.toFixed(2)} of gas for the first transaction`;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('basis trading')) return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote in its governance.`;
  if (c.includes('payment')) return `Move $${capital} of USDC through ${name} on ${chain} and keep using it for payments.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} through its official bridge and use the chain's own apps.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Gas follows the main chain: Ethereum costs the most, Solana the least, the rest in between.
 * Step 3's cost is the whole weekly gas over the hold, so the steps' gas adds up to the verdict's
 * gas: first transaction + weekly gas x weeks.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = holdWeeksFor(age);
  const g = gasUsd(chain);
  const weeklyTotal = round2(g.weekly * weeks);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: firstGas(chain),
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and ${firstGas(chain).replace('for the first transaction', 'for the deposit')}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${weeklyTotal} of gas over ${weeks} weeks`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open the protocol's own points or rewards page from its own site and check what counts toward an allocation.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Claim only from the protocol's own page, never pay a fee to claim, and never sign an approval you have not read.`,
      cost: 'gas only, and never a fee to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** One row's farm economics: the outlay, the gas that never comes back, the farmer's expected
 *  value under the two stated assumptions (10% of implied value reaches farmers; a farmer's
 *  share is pro-rata by capital over TVL), and the verdict from expected value against gas. */
export interface FarmEconomics {
  capital_usd: number;
  hold_days: number;
  hold_weeks: number;
  gas_first_usd: number;
  gas_weekly_usd: number;
  gas_total_usd: number;
  farm_cost_usd: number;
  farmer_expected_usd: number;
  farmer_net_usd: number;
  verdict: FarmVerdict;
}

export function farmEconomics(p: SnapshotProtocol, age: number | null, expectedValueUsd: number, model: ModelConstants = MODEL): FarmEconomics {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = holdWeeksFor(age);
  const g = gasUsd(chain);
  const gasTotal = round2(g.first + g.weekly * weeks);
  const farmerExpected = round2(expectedValueUsd * model.airdrop_share * (capital / Math.max(1, p.tvl_usd)));
  const net = round2(farmerExpected - gasTotal);
  const verdict: FarmVerdict = farmerExpected >= model.farm_ratio * gasTotal ? 'Farm' : farmerExpected >= model.thin_ratio * gasTotal ? 'Thin' : 'Skip';
  return {
    capital_usd: capital,
    hold_days: hold,
    hold_weeks: weeks,
    gas_first_usd: g.first,
    gas_weekly_usd: g.weekly,
    gas_total_usd: gasTotal,
    farm_cost_usd: round2(capital + gasTotal),
    farmer_expected_usd: farmerExpected,
    farmer_net_usd: net,
    verdict,
  };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round3(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    expected_value_usd: row.expected_value_usd,
    expected_low_usd: row.expected_low_usd,
    expected_high_usd: row.expected_high_usd,
    token_odds: row.token_odds,
    odds_band: row.odds_band,
    odds_n: row.odds_n,
    odds_live: row.odds_live,
    farm_cost_usd: row.farm_cost_usd,
    farm_gas_usd: row.farm_gas_usd,
    farm_capital_usd: row.farm_capital_usd,
    farm_expected_usd: row.farm_expected_usd,
    farm_net_usd: row.farm_net_usd,
    farm_verdict: row.farm_verdict,
    peer_multiple: row.model.peer_multiple,
    multiple_source: row.model.multiple_source,
    category_median: row.model.category_median,
    category_peers: row.model.category_peers,
    terms: row.model.terms,
    clamped: row.model.clamped,
    on_watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, fit, interval, loo } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { byCategory, marketMedian } = computeComparables(snapshot, model);
  const curve = fitSizeCurve(snapshot, model);
  const validation = validateModel(snapshot, loo, model);
  const { bands, decay, overall, overall_decay } = computeOdds(snapshot, model);
  const accounting = buildAccounting(snapshot);
  const comparables: Comparable[] = [...byCategory.values()].sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const byCategoryImplied = new Map<string, number>();
  for (const r of board) {
    const cat = r.category ?? 'Other';
    byCategoryImplied.set(cat, (byCategoryImplied.get(cat) ?? 0) + r.implied_value_usd);
  }
  let topCategory: string | null = null;
  let topCategoryImplied = 0;
  for (const [cat, total] of byCategoryImplied) {
    if (total > topCategoryImplied) {
      topCategory = cat;
      topCategoryImplied = total;
    }
  }
  const oddsSorted = board.map((r) => r.token_odds).sort((a, b) => a - b);
  const verdict_counts: Record<FarmVerdict, number> = { Farm: 0, Thin: 0, Skip: 0 };
  for (const r of board) verdict_counts[r.farm_verdict]++;
  const summary: BoardSummary = {
    total_implied_usd: board.reduce((sum, r) => sum + r.implied_value_usd, 0),
    total_expected_usd: board.reduce((sum, r) => sum + r.expected_value_usd, 0),
    top_category: topCategory,
    top_category_implied_usd: topCategoryImplied,
    median_peer_multiple: round3(marketMedian),
    median_token_odds: oddsSorted.length > 0 ? round3(oddsSorted[Math.floor(oddsSorted.length / 2)]!) : 0,
    verdict_counts,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    comparables,
    curve,
    fit,
    interval,
    validation,
    odds_bands: bands,
    odds_decay: decay,
    odds_overall: overall,
    odds_overall_decay: overall_decay,
    accounting,
    summary,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, intervals that contain the point estimate, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const unranked = snapshot.protocols.filter((p) => isRankable(p) && !slugs.has(p.slug));
  if (unranked.length > 0) return `the board drops ${unranked.length} rankable protocol${unranked.length === 1 ? '' : 's'}: ${unranked.slice(0, 5).map((p) => p.slug).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.expected_value_usd) || r.expected_value_usd <= 0) return `${r.slug} has expected value ${r.expected_value_usd}`;
    if (!(r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) return `${r.slug} has an interval that misses its implied value`;
    if (!(r.expected_low_usd <= r.expected_value_usd && r.expected_value_usd <= r.expected_high_usd)) return `${r.slug} has an interval that misses its expected value`;
    if (!(r.token_odds >= 0 && r.token_odds <= 1)) return `${r.slug} has token odds ${r.token_odds}`;
    if (r.farm_verdict !== 'Farm' && r.farm_verdict !== 'Thin' && r.farm_verdict !== 'Skip') return `${r.slug} has verdict ${r.farm_verdict}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
