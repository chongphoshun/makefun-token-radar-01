// Token Radar, radar-6.
// A pre-token radar: it prices what a protocol's token would be worth if it
// launched at the going rate for live tokens, then asks whether the launch is
// worth farming. Every number comes from the sealed snapshot; nothing here
// names a protocol in advance.

export const MODEL_VERSION = "radar-6";

export const MODEL = {
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

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface TermContribution {
  label: string;
  value: number;
}

export interface ModelDetail {
  peer_multiple: number;
  multiple_source: string;
  category_median: number | null;
  category_peers: number;
  terms: TermContribution[];
  clamped: boolean;
  age_days: number | null;
}

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
  token_status: string;
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
  farm_verdict: string;
  model: ModelDetail;
  farm_steps: string[];
}

export interface CompactRow {
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
  farm_verdict: string;
  peer_multiple: number;
  multiple_source: string;
  category_median: number | null;
  category_peers: number;
  terms: TermContribution[];
  clamped: boolean;
  on_watchlist: boolean;
}

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

export interface Radar {
  as_of: string;
  source: string;
  floor_usd: number;
  model: typeof MODEL;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  comparables: Comparable[];
  curve: SizeCurve;
  fit: MultiFit;
  interval: ConformalInterval;
  validation: Validation;
  odds_bands: OddsBand[];
  odds_decay: OddsDecay[];
  odds_overall: number;
  odds_overall_decay: number;
  accounting: Accounting;
  summary: Summary;
  rows: CompactRow[];
  live: LiveRow[];
}

export interface Comparable {
  category: string;
  peers: number;
  median_ratio: number;
  multiple: number;
  source: string;
}

export interface SizeCurve {
  a: number;
  b: number;
  n: number;
  flat_median: number;
}

export interface MultiFit {
  coefficients: TermContribution[];
  dummy_categories: string[];
  n: number;
  r2: number;
}

export interface ConformalInterval {
  q90: number;
  coverage: number;
  loo_n: number;
}

export interface MethodScores {
  n: number;
  multi: number;
  single: number;
  flat: number;
  category: number;
}

export interface GroupedScores extends MethodScores {
  name: string;
}

export interface Validation {
  loo: MethodScores;
  chronological: MethodScores;
  split: MethodScores;
  grouped: MethodScores;
  grouped_by_category: GroupedScores[];
}

export interface OddsBand {
  band: string;
  min_days: number;
  max_days: number | null;
  protocols: number;
  live: number;
  rate: number;
}

export interface OddsDecay {
  band: string;
  protocols: number;
  pre_token: number;
  pre_share: number;
  decay: number;
}

export interface Accounting {
  total: number;
  ranked: number;
  excluded: ExcludedReason[];
}

export interface ExcludedReason {
  reason: string;
  count: number;
  examples: string[];
}

export interface Summary {
  total_implied_usd: number;
  total_expected_usd: number;
  top_category: string | null;
  top_category_implied_usd: number;
  median_peer_multiple: number;
  median_token_odds: number;
  verdict_counts: Record<string, number>;
}

export interface BoardResult {
  rows: BoardRow[];
  radar: Radar;
}

// ---- small numeric helpers ----

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function parseDay(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const back = new Date(stamp);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return stamp;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  const start = parseDay(asOf);
  const listed = parseDay(listedAt);
  if (start === null || listed === null) return null;
  return Math.max(0, Math.floor((start - listed) / 86400000));
}

// ---- snapshot parsing ----

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("snapshot is not JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("snapshot is not an object");
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc.as_of !== "string" || parseDay(doc.as_of) === null) {
    throw new Error("snapshot as_of is missing or badly formatted");
  }
  if (typeof doc.source !== "string" || doc.source.length === 0) {
    throw new Error("snapshot source is missing");
  }
  if (
    typeof doc.floor_usd !== "number" ||
    !Number.isSafeInteger(doc.floor_usd) ||
    doc.floor_usd <= 0
  ) {
    throw new Error("snapshot floor_usd is not a positive safe integer");
  }
  if (!Array.isArray(doc.protocols)) {
    throw new Error("snapshot protocols is missing");
  }
  if (
    !Array.isArray(doc.watchlist) ||
    !doc.watchlist.every((entry) => typeof entry === "string")
  ) {
    throw new Error("snapshot watchlist is not an array of strings");
  }
  const protocols: SnapshotProtocol[] = doc.protocols.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`protocol at index ${index} is not an object`);
    }
    const p = entry as Record<string, unknown>;
    if (typeof p.slug !== "string") {
      throw new Error(`protocol at index ${index} has no string slug`);
    }
    if (typeof p.name !== "string") {
      throw new Error(`protocol at index ${index} has no string name`);
    }
    if (typeof p.tvl_usd !== "number" || !Number.isFinite(p.tvl_usd)) {
      throw new Error(`protocol ${p.slug} has no finite tvl_usd`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === "string" ? p.category : null,
      chains: Array.isArray(p.chains)
        ? (p.chains.filter((chain) => typeof chain === "string") as string[])
        : [],
      tvl_usd: p.tvl_usd,
      change_7d:
        typeof p.change_7d === "number" && Number.isFinite(p.change_7d)
          ? p.change_7d
          : null,
      mcap_usd:
        typeof p.mcap_usd === "number" && Number.isFinite(p.mcap_usd)
          ? p.mcap_usd
          : null,
      listed_at: typeof p.listed_at === "string" ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === "string" ? p.gecko_id : null,
      symbol: typeof p.symbol === "string" ? p.symbol : null,
    };
  });
  return {
    as_of: doc.as_of,
    source: doc.source,
    floor_usd: doc.floor_usd,
    protocols,
    watchlist: [...(doc.watchlist as string[])],
  };
}

// ---- protocol facts ----

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function categoryOf(p: SnapshotProtocol): string {
  return p.category === null ? "Other" : p.category;
}

export function livePeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) =>
      !isPreToken(p) &&
      p.category !== "CEX" &&
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0,
  );
}

function ratioOf(p: SnapshotProtocol): number {
  return (p.mcap_usd as number) / p.tvl_usd;
}

// ---- linear algebra: Gaussian elimination with partial pivoting ----

function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  const pivotColumnForRow: number[] = new Array(n).fill(-1);
  let row = 0;
  for (let col = 0; col < n && row < n; col++) {
    let best = row;
    let bestValue = Math.abs(a[row][col]);
    for (let r = row + 1; r < n; r++) {
      const value = Math.abs(a[r][col]);
      if (value > bestValue) {
        bestValue = value;
        best = r;
      }
    }
    if (bestValue < 1e-10) continue;
    if (best !== row) {
      const held = a[best];
      a[best] = a[row];
      a[row] = held;
    }
    pivotColumnForRow[row] = col;
    for (let r = row + 1; r < n; r++) {
      const factor = a[r][col] / a[row][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) a[r][c] -= factor * a[row][c];
    }
    row++;
  }
  const x: number[] = new Array(n).fill(0);
  for (let r = row - 1; r >= 0; r--) {
    const col = pivotColumnForRow[r];
    let sum = a[r][n];
    for (let c = col + 1; c < n; c++) sum -= a[r][c] * x[c];
    x[col] = sum / a[r][col];
  }
  return x;
}

function leastSquares(features: number[][], target: number[]): number[] {
  const k = features[0].length;
  const xtx: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const xty: number[] = new Array(k).fill(0);
  for (let i = 0; i < features.length; i++) {
    for (let a = 0; a < k; a++) {
      xty[a] += features[i][a] * target[i];
      for (let b = 0; b < k; b++) xtx[a][b] += features[i][a] * features[i][b];
    }
  }
  return solveLinear(xtx, xty);
}

// ---- the multi-term fit ----

export function dummyCategories(peers: SnapshotProtocol[]): string[] {
  const counts = new Map<string, number>();
  for (const p of peers) {
    const c = categoryOf(p);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= MODEL.min_dummy_peers)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, MODEL.max_dummies)
    .map(([name]) => name);
}

export function fitLabels(dummies: string[]): string[] {
  return [
    "intercept",
    "log TVL",
    "growth",
    "log1p age",
    ...dummies.map((d) => `cat: ${d}`),
  ];
}

export function featureRow(
  p: SnapshotProtocol,
  asOf: string,
  dummies: string[],
): number[] {
  const age = ageDays(asOf, p.listed_at);
  const knownAge = age === null ? MODEL.unknown_age_days : age;
  const growth =
    p.change_7d === null
      ? 0
      : clamp(p.change_7d, MODEL.growth_floor, MODEL.growth_cap) / 100;
  const row = [1, Math.log(Math.max(1, p.tvl_usd)), growth, Math.log1p(knownAge)];
  for (const d of dummies) row.push(categoryOf(p) === d ? 1 : 0);
  return row;
}

export interface FittedModel {
  coefficients: number[];
  labels: string[];
  dummyCategories: string[];
  n: number;
  r2: number;
}

export function fitMulti(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): FittedModel {
  const labels = fitLabels(dummies);
  if (peers.length === 0) {
    return {
      coefficients: labels.map(() => 0),
      labels,
      dummyCategories: dummies,
      n: 0,
      r2: 0,
    };
  }
  const features = peers.map((p) => featureRow(p, asOf, dummies));
  const target = peers.map((p) => Math.log(ratioOf(p)));
  const raw = leastSquares(features, target);
  const coefficients = raw.map((v) => roundTo(v, 4));
  const predictions = features.map((row) =>
    row.reduce((sum, value, i) => sum + value * coefficients[i], 0),
  );
  const mean = target.reduce((sum, v) => sum + v, 0) / target.length;
  let residualSum = 0;
  let totalSum = 0;
  for (let i = 0; i < target.length; i++) {
    residualSum += (target[i] - predictions[i]) ** 2;
    totalSum += (target[i] - mean) ** 2;
  }
  const r2 =
    totalSum === 0 || peers.length === 0
      ? 0
      : roundTo(1 - residualSum / totalSum, 4);
  return { coefficients, labels, dummyCategories: dummies, n: peers.length, r2 };
}

export function termContributions(
  p: SnapshotProtocol,
  asOf: string,
  fit: FittedModel,
): TermContribution[] {
  const features = featureRow(p, asOf, fit.dummyCategories);
  return fit.labels.map((label, i) => ({
    label,
    value: roundTo(fit.coefficients[i] * features[i], 4),
  }));
}

function predictedLogMultiple(
  p: SnapshotProtocol,
  asOf: string,
  fit: FittedModel,
): number {
  const features = featureRow(p, asOf, fit.dummyCategories);
  return features.reduce((sum, value, i) => sum + value * fit.coefficients[i], 0);
}

export function pricedMultiple(
  p: SnapshotProtocol,
  asOf: string,
  fit: FittedModel,
): { multiple: number; clamped: boolean } {
  const raw = Math.exp(predictedLogMultiple(p, asOf, fit));
  const clamped = raw < MODEL.multiple_floor || raw > MODEL.multiple_cap;
  return {
    multiple: roundTo(clamp(raw, MODEL.multiple_floor, MODEL.multiple_cap), 3),
    clamped,
  };
}

// ---- the single-term size curve, kept as a comparison method ----

export function fitCurve(peers: SnapshotProtocol[]): SizeCurve {
  const ratios = peers.map((p) => ratioOf(p));
  const flatMedian = roundTo(median(ratios), 3);
  if (peers.length < 2) {
    return { a: roundTo(Math.log(flatMedian), 4), b: 0, n: peers.length, flat_median: flatMedian };
  }
  const xs = peers.map((p) => Math.log(p.tvl_usd));
  const ys = peers.map((p) => Math.log(ratioOf(p)));
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  const b = denominator === 0 ? 0 : numerator / denominator;
  const a = meanY - b * meanX;
  return { a: roundTo(a, 4), b: roundTo(b, 4), n, flat_median: flatMedian };
}

export function curveMultiple(tvl: number, curve: SizeCurve): number {
  const raw = Math.exp(curve.a + curve.b * Math.log(Math.max(1, tvl)));
  return roundTo(clamp(raw, MODEL.multiple_floor, MODEL.multiple_cap), 3);
}

// ---- comparables: what live tokens actually trade at ----

export function marketMedian(peers: SnapshotProtocol[]): number {
  if (peers.length === 0) return 0.25;
  return roundTo(median(peers.map((p) => ratioOf(p))), 3);
}

export function comparables(peers: SnapshotProtocol[]): Comparable[] {
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of peers) {
    const c = categoryOf(p);
    const list = byCategory.get(c) ?? [];
    list.push(p);
    byCategory.set(c, list);
  }
  const market = marketMedian(peers);
  const rows: Comparable[] = [];
  for (const [category, list] of byCategory) {
    const medianRatio = roundTo(median(list.map((p) => ratioOf(p))), 3);
    if (list.length >= MODEL.min_category_peers) {
      rows.push({
        category,
        peers: list.length,
        median_ratio: medianRatio,
        multiple: roundTo(
          clamp(medianRatio, MODEL.multiple_floor, MODEL.multiple_cap),
          3,
        ),
        source: "category",
      });
    } else {
      rows.push({
        category,
        peers: list.length,
        median_ratio: medianRatio,
        multiple: market,
        source: "market",
      });
    }
  }
  rows.sort(
    (a, b) =>
      b.multiple - a.multiple ||
      (a.category < b.category ? -1 : a.category > b.category ? 1 : 0),
  );
  return rows;
}

export function categoryMedian(
  peers: SnapshotProtocol[],
  category: string,
): { median: number | null; peers: number } {
  const ratios = peers
    .filter((p) => categoryOf(p) === category)
    .map((p) => ratioOf(p));
  if (ratios.length < MODEL.min_category_peers) {
    return { median: null, peers: ratios.length };
  }
  return { median: roundTo(median(ratios), 3), peers: ratios.length };
}

// ---- conformal interval from leave-one-out residuals ----

export function leaveOneOutInterval(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): ConformalInterval {
  const residuals: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    const train = peers.filter((_, j) => j !== i);
    if (train.length === 0) continue;
    const fit = fitMulti(train, asOf, dummies);
    const predicted = pricedMultiple(peers[i], asOf, fit).multiple;
    residuals.push(Math.abs(Math.log(ratioOf(peers[i]) / predicted)));
  }
  if (residuals.length === 0) return { q90: 0, coverage: 0, loo_n: 0 };
  const sorted = [...residuals].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(0.9 * sorted.length) - 1);
  const q90 = roundTo(sorted[index], 4);
  const inside = residuals.filter((r) => r <= q90).length;
  return { q90, coverage: roundTo(inside / residuals.length, 3), loo_n: residuals.length };
}

// ---- validations: four ways of holding out ----

function flatPrediction(train: SnapshotProtocol[]): number {
  if (train.length === 0) return 0.25;
  return clamp(
    median(train.map((p) => ratioOf(p))),
    MODEL.multiple_floor,
    MODEL.multiple_cap,
  );
}

function categoryPrediction(
  train: SnapshotProtocol[],
  category: string,
  flat: number,
): number {
  const ratios = train
    .filter((p) => categoryOf(p) === category)
    .map((p) => ratioOf(p));
  if (ratios.length < MODEL.min_category_peers) return flat;
  return clamp(median(ratios), MODEL.multiple_floor, MODEL.multiple_cap);
}

function fourPredictions(
  held: SnapshotProtocol,
  train: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): { multi: number; single: number; flat: number; category: number } {
  const fit = fitMulti(train, asOf, dummies);
  const multi = pricedMultiple(held, asOf, fit).multiple;
  const single = curveMultiple(held.tvl_usd, fitCurve(train));
  const flat = flatPrediction(train);
  return { multi, single, flat, category: categoryPrediction(train, categoryOf(held), flat) };
}

function scoreHeldOut(
  test: SnapshotProtocol[],
  train: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): MethodScores {
  const sums = { multi: 0, single: 0, flat: 0, category: 0 };
  let scored = 0;
  for (const held of test) {
    if (held.mcap_usd === null || held.tvl_usd <= 0) continue;
    const actual = ratioOf(held);
    const predicted = fourPredictions(held, train, asOf, dummies);
    sums.multi += Math.abs(Math.log(actual / predicted.multi));
    sums.single += Math.abs(Math.log(predicted.single / actual));
    sums.flat += Math.abs(Math.log(predicted.flat / actual));
    sums.category += Math.abs(Math.log(predicted.category / actual));
    scored++;
  }
  const divisor = Math.max(1, scored);
  return {
    n: scored,
    multi: roundTo(sums.multi / divisor, 4),
    single: roundTo(sums.single / divisor, 4),
    flat: roundTo(sums.flat / divisor, 4),
    category: roundTo(sums.category / divisor, 4),
  };
}

function zeroScores(): MethodScores {
  return { n: 0, multi: 0, single: 0, flat: 0, category: 0 };
}

function leaveOneOutValidation(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): MethodScores {
  const sums = { multi: 0, single: 0, flat: 0, category: 0 };
  let scored = 0;
  for (let i = 0; i < peers.length; i++) {
    const train = peers.filter((_, j) => j !== i);
    if (train.length < 10) continue;
    const held = peers[i];
    if (held.mcap_usd === null || held.tvl_usd <= 0) continue;
    const actual = ratioOf(held);
    const predicted = fourPredictions(held, train, asOf, dummies);
    sums.multi += Math.abs(Math.log(actual / predicted.multi));
    sums.single += Math.abs(Math.log(predicted.single / actual));
    sums.flat += Math.abs(Math.log(predicted.flat / actual));
    sums.category += Math.abs(Math.log(predicted.category / actual));
    scored++;
  }
  const divisor = Math.max(1, scored);
  return {
    n: scored,
    multi: roundTo(sums.multi / divisor, 4),
    single: roundTo(sums.single / divisor, 4),
    flat: roundTo(sums.flat / divisor, 4),
    category: roundTo(sums.category / divisor, 4),
  };
}

function chronologicalValidation(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): MethodScores {
  const dated = peers
    .filter((p) => ageDays(asOf, p.listed_at) !== null)
    .sort((a, b) => {
      const ageA = ageDays(asOf, a.listed_at) as number;
      const ageB = ageDays(asOf, b.listed_at) as number;
      return ageA - ageB || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    });
  const cut = Math.floor(dated.length * 0.7);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  if (train.length < 10 || test.length < 5) return zeroScores();
  return scoreHeldOut(test, train, asOf, dummies);
}

function hashSplitValidation(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): MethodScores {
  const hash = (slug: string) =>
    [...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const test = peers.filter((p) => hash(p.slug) % 5 === 0);
  const train = peers.filter((p) => hash(p.slug) % 5 !== 0);
  if (train.length < 10 || test.length < 5) return zeroScores();
  return scoreHeldOut(test, train, asOf, dummies);
}

function groupedValidation(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): { pooled: MethodScores; byCategory: GroupedScores[] } {
  const counts = new Map<string, number>();
  for (const p of peers) {
    const c = categoryOf(p);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const heldOut = [...counts.entries()]
    .filter(([, count]) => count >= 10)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name]) => name);
  const byCategory: GroupedScores[] = [];
  for (const name of heldOut) {
    const test = peers.filter((p) => categoryOf(p) === name);
    const train = peers.filter((p) => categoryOf(p) !== name);
    const scored = scoreHeldOut(test, train, asOf, dummies);
    byCategory.push({ name, ...scored });
  }
  const total = byCategory.reduce((sum, row) => sum + row.n, 0);
  if (total === 0) return { pooled: zeroScores(), byCategory };
  const pooled: MethodScores = {
    n: total,
    multi: roundTo(
      byCategory.reduce((s, r) => s + r.multi * r.n, 0) / total,
      4,
    ),
    single: roundTo(
      byCategory.reduce((s, r) => s + r.single * r.n, 0) / total,
      4,
    ),
    flat: roundTo(
      byCategory.reduce((s, r) => s + r.flat * r.n, 0) / total,
      4,
    ),
    category: roundTo(
      byCategory.reduce((s, r) => s + r.category * r.n, 0) / total,
      4,
    ),
  };
  return { pooled, byCategory };
}

export function runValidations(
  peers: SnapshotProtocol[],
  asOf: string,
  dummies: string[],
): Validation {
  const grouped = groupedValidation(peers, asOf, dummies);
  return {
    loo: leaveOneOutValidation(peers, asOf, dummies),
    chronological: chronologicalValidation(peers, asOf, dummies),
    split: hashSplitValidation(peers, asOf, dummies),
    grouped: grouped.pooled,
    grouped_by_category: grouped.byCategory,
  };
}

// ---- exclusions: why a protocol is not rankable ----

const VERSION_RE = / (?:[Vv]\d+(?:\.\d+)?|\d+\.\d+)$/;
const WRAPPED_RE = /\b(?:wrapped|wrapper|wrapping|staked|staking)\b/i;
const EXCHANGE_PREFIXES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
];

export const EXCLUSION_ORDER = [
  "live token",
  "CEX",
  "versioned pool",
  "wrapped or staked product",
  "bridge product",
  "staked product",
  "exchange product",
];

export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return "live token";
  if (p.category === "CEX") return "CEX";
  if (VERSION_RE.test(p.name)) return "versioned pool";
  if (WRAPPED_RE.test(p.name)) return "wrapped or staked product";
  if (p.category === "Bridge" || p.category === "Canonical Bridge") {
    return "bridge product";
  }
  if (
    p.category === "Liquid Staking" ||
    p.category === "Liquid Restaking" ||
    p.category === "Restaked BTC"
  ) {
    return "staked product";
  }
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) {
    return "exchange product";
  }
  return null;
}

function buildAccounting(snapshot: Snapshot): Accounting {
  const byReason = new Map<string, SnapshotProtocol[]>();
  let ranked = 0;
  for (const p of snapshot.protocols) {
    const reason = exclusionReason(p);
    if (reason === null) {
      ranked++;
      continue;
    }
    const list = byReason.get(reason) ?? [];
    list.push(p);
    byReason.set(reason, list);
  }
  const excluded: ExcludedReason[] = [];
  for (const reason of EXCLUSION_ORDER) {
    const list = byReason.get(reason);
    if (list === undefined) continue;
    const examples = [...list]
      .sort(
        (a, b) =>
          b.tvl_usd - a.tvl_usd ||
          (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
      )
      .slice(0, 5)
      .map((p) => p.slug);
    excluded.push({ reason, count: list.length, examples });
  }
  return { total: snapshot.protocols.length, ranked, excluded };
}

// ---- token odds: how often protocols this old and this kind launch ----

const AGE_BANDS: { min: number; max: number | null }[] = [
  { min: 0, max: 180 },
  { min: 180, max: 365 },
  { min: 365, max: 730 },
  { min: 730, max: 1095 },
  { min: 1095, max: null },
];

function bandLabel(min: number, max: number | null): string {
  return max === null ? `${min}d+` : `${min}–${max}d`;
}

interface OddsTable {
  bands: OddsBand[];
  decay: OddsDecay[];
  overallRate: number;
  overallDecay: number;
  categoryCounts: Map<string, { n: number; live: number }>;
}

function buildOdds(snapshot: Snapshot): OddsTable {
  const universe = snapshot.protocols.filter((p) => {
    const reason = exclusionReason(p);
    return reason === null || reason === "live token";
  });
  const liveCount = universe.filter((p) => !isPreToken(p)).length;
  const overallRate = roundTo(liveCount / Math.max(1, universe.length), 3);
  const categoryCounts = new Map<string, { n: number; live: number }>();
  for (const p of universe) {
    const c = categoryOf(p);
    const entry = categoryCounts.get(c) ?? { n: 0, live: 0 };
    entry.n++;
    if (!isPreToken(p)) entry.live++;
    categoryCounts.set(c, entry);
  }
  const bands: OddsBand[] = [];
  const decay: OddsDecay[] = [];
  let youngestPreShare: number | null = null;
  let runningMinimum: number | null = null;
  for (const band of AGE_BANDS) {
    const members = universe.filter((p) => {
      const age = ageDays(snapshot.as_of, p.listed_at);
      if (age === null) return false;
      return age >= band.min && (band.max === null || age < band.max);
    });
    const live = members.filter((p) => !isPreToken(p)).length;
    const preToken = members.length - live;
    const preShare = members.length === 0 ? 0 : preToken / members.length;
    if (youngestPreShare === null) youngestPreShare = preShare;
    const divisor = youngestPreShare === 0 ? 1 : youngestPreShare;
    const ratio = preShare / divisor;
    runningMinimum =
      runningMinimum === null ? ratio : Math.min(runningMinimum, ratio);
    bands.push({
      band: bandLabel(band.min, band.max),
      min_days: band.min,
      max_days: band.max,
      protocols: members.length,
      live,
      rate: members.length === 0 ? 0 : roundTo(live / members.length, 3),
    });
    decay.push({
      band: bandLabel(band.min, band.max),
      protocols: members.length,
      pre_token: preToken,
      pre_share: roundTo(preShare, 3),
      decay: roundTo(clamp(runningMinimum, 0, 1), 3),
    });
  }
  const divisor =
    youngestPreShare === null || youngestPreShare === 0
      ? 1
      : youngestPreShare;
  const universePreShare =
    universe.length === 0
      ? 0
      : universe.filter((p) => isPreToken(p)).length / universe.length;
  const overallDecay = roundTo(clamp(universePreShare / divisor, 0, 1), 3);
  return { bands, decay, overallRate, overallDecay, categoryCounts };
}

function oddsFor(
  p: SnapshotProtocol,
  snapshot: Snapshot,
  odds: OddsTable,
): { odds: number; band: string; n: number; live: number } {
  const entry = odds.categoryCounts.get(categoryOf(p)) ?? { n: 0, live: 0 };
  const shrunk =
    (entry.live + MODEL.odds_shrink * odds.overallRate) /
    (entry.n + MODEL.odds_shrink);
  const age = ageDays(snapshot.as_of, p.listed_at);
  if (age === null) {
    return {
      odds: roundTo(clamp(shrunk * odds.overallDecay, 0, 1), 3),
      band: "age unknown",
      n: entry.n,
      live: entry.live,
    };
  }
  for (let i = 0; i < AGE_BANDS.length; i++) {
    const band = AGE_BANDS[i];
    if (age >= band.min && (band.max === null || age < band.max)) {
      return {
        odds: roundTo(clamp(shrunk * odds.decay[i].decay, 0, 1), 3),
        band: odds.bands[i].band,
        n: entry.n,
        live: entry.live,
      };
    }
  }
  const last = odds.decay[odds.decay.length - 1];
  return {
    odds: roundTo(clamp(shrunk * last.decay, 0, 1), 3),
    band: last.band,
    n: entry.n,
    live: entry.live,
  };
}

// ---- farm economics and the seven-step plan ----

interface FarmNumbers {
  capital: number;
  holdDays: number;
  weeks: number;
  chain: string;
  firstGas: number;
  weeklyGas: number;
  gasTotal: number;
  farmerExpected: number;
  net: number;
  cost: number;
  verdict: string;
}

function farmNumbers(
  p: SnapshotProtocol,
  age: number | null,
  expected: number,
): FarmNumbers {
  const tvl = p.tvl_usd;
  const capital =
    tvl >= 5_000_000_000
      ? 250
      : tvl >= 1_000_000_000
        ? 150
        : tvl >= 100_000_000
          ? 100
          : 50;
  const holdDays =
    age === null ? 30 : age < 180 ? 60 : age < 365 ? 45 : 30;
  const weeks = Math.max(1, Math.ceil(holdDays / 7));
  const chain = p.chains.length > 0 ? p.chains[0] : "Ethereum";
  let firstGas: number;
  let weeklyGas: number;
  if (chain === "Ethereum") {
    firstGas = 15;
    weeklyGas = 8;
  } else if (chain === "Solana") {
    firstGas = 0.1;
    weeklyGas = 0.1;
  } else {
    firstGas = 0.5;
    weeklyGas = 0.1;
  }
  const gasTotal = roundTo(firstGas + weeklyGas * weeks, 2);
  const farmerExpected = roundTo(
    (expected * MODEL.airdrop_share * capital) / Math.max(1, tvl),
    2,
  );
  const net = roundTo(farmerExpected - gasTotal, 2);
  const cost = roundTo(capital + gasTotal, 2);
  const verdict =
    farmerExpected >= MODEL.farm_ratio * gasTotal
      ? "Farm"
      : farmerExpected >= MODEL.thin_ratio * gasTotal
        ? "Thin"
        : "Skip";
  return {
    capital,
    holdDays,
    weeks,
    chain,
    firstGas,
    weeklyGas,
    gasTotal,
    farmerExpected,
    net,
    cost,
    verdict,
  };
}

function gasPhrase(firstGas: number): string {
  if (firstGas >= 1) {
    return `about $${firstGas} of gas for the first transaction`;
  }
  return `under $${firstGas.toFixed(2)} of gas for the first transaction`;
}

function categoryAction(
  p: SnapshotProtocol,
  capital: number,
  chain: string,
): string {
  const c = (p.category ?? "").toLowerCase();
  const name = p.name;
  if (c.includes("basis trading")) {
    return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open.`;
  }
  if (c.includes("lend") || c.includes("cdp") || c.includes("collateral")) {
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  }
  if (c.includes("dex") || c.includes("yield") || c.includes("leveraged farm")) {
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  }
  if (c.includes("bridge")) {
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  }
  if (c.includes("staking") || c.includes("restak")) {
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  }
  if (c.includes("perpetual") || c.includes("derivative")) {
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  }
  if (c.includes("prediction")) {
    return `Fund $${capital} and place one market position on ${name}.`;
  }
  if (c.includes("curator") || c.includes("allocator") || c.includes("risk")) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  }
  if (c.includes("stable")) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  }
  if (c.includes("rwa")) {
    return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  }
  if (c.includes("insurance")) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  }
  if (c.includes("governance")) {
    return `Deposit $${capital} into ${name} on ${chain} and vote in its governance.`;
  }
  if (c.includes("payment")) {
    return `Move $${capital} of USDC through ${name} on ${chain} and keep using it for payments.`;
  }
  if (c.includes("chain")) {
    return `Bridge $${capital} of USDC to ${chain} through its official bridge and use the chain's own apps.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

function renderStep(text: string, cost: string, time: string): string {
  let step = `${text} Cost: ${cost}. Time: ${time}.`;
  if (step.length > 600) step = `${step.slice(0, 596)}...`;
  if (step.length < 20) {
    step += " Hold the position and check the protocol's own page.";
  }
  return step;
}

function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const plan = farmNumbers(p, age, 0);
  const first = gasPhrase(plan.firstGas);
  const deposit = first.replace("for the first transaction", "for the deposit");
  const weeklyTotal = roundTo(plan.weeklyGas * plan.weeks, 2);
  return [
    renderStep(
      "Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.",
      first,
      "5 minutes",
    ),
    renderStep(
      categoryAction(p, plan.capital, plan.chain),
      `$${plan.capital} of capital and ${deposit}`,
      "15 minutes to set up",
    ),
    renderStep(
      "Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.",
      `about $${weeklyTotal} of gas over ${plan.weeks} weeks`,
      "10 minutes a week",
    ),
    renderStep(
      `Hold the position for at least ${plan.holdDays} days so the activity is counted in more than one snapshot.`,
      `the $${plan.capital} stays in the position`,
      `${plan.holdDays} days`,
    ),
    renderStep(
      "Open the protocol's own points or rewards page from its own site and check what counts toward an allocation.",
      "no fee to check",
      "10 minutes",
    ),
    renderStep(
      "Claim only from the protocol's own page, never pay a fee to claim, and never sign an approval you have not read.",
      "gas only, and never a fee to claim",
      "10 minutes",
    ),
    renderStep(
      "Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.",
      "nothing but the log",
      "5 minutes",
    ),
  ];
}

// ---- the board ----

export function buildBoard(snapshot: Snapshot): BoardResult {
  const peers = livePeers(snapshot);
  const dummies = dummyCategories(peers);
  const fit = fitMulti(peers, snapshot.as_of, dummies);
  const curve = fitCurve(peers);
  const interval = leaveOneOutInterval(peers, snapshot.as_of, dummies);
  const validation = runValidations(peers, snapshot.as_of, dummies);
  const odds = buildOdds(snapshot);
  const accounting = buildAccounting(snapshot);
  const watchlist = new Set(snapshot.watchlist);

  const scored: BoardRow[] = [];
  for (const p of snapshot.protocols) {
    if (exclusionReason(p) !== null) continue;
    const age = ageDays(snapshot.as_of, p.listed_at);
    const priced = pricedMultiple(p, snapshot.as_of, fit);
    const terms = termContributions(p, snapshot.as_of, fit);
    const cross = categoryMedian(peers, categoryOf(p));
    const implied = Math.max(1, Math.round(p.tvl_usd * priced.multiple));
    const low = Math.max(1, Math.round(implied * Math.exp(-interval.q90)));
    const high = Math.max(1, Math.round(implied * Math.exp(interval.q90)));
    const found = oddsFor(p, snapshot, odds);
    const expected = Math.max(1, Math.round(implied * found.odds));
    const expectedLow = Math.max(1, Math.round(low * found.odds));
    const expectedHigh = Math.max(1, Math.round(high * found.odds));
    const farm = farmNumbers(p, age, expected);
    scored.push({
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d === null ? null : roundTo(p.change_7d, 4),
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: "pre-token",
      age_days: age,
      implied_value_usd: implied,
      implied_low_usd: low,
      implied_high_usd: high,
      expected_value_usd: expected,
      expected_low_usd: expectedLow,
      expected_high_usd: expectedHigh,
      token_odds: found.odds,
      odds_band: found.band,
      odds_n: found.n,
      odds_live: found.live,
      farm_cost_usd: farm.cost,
      farm_gas_usd: farm.gasTotal,
      farm_capital_usd: farm.capital,
      farm_expected_usd: farm.farmerExpected,
      farm_net_usd: farm.net,
      farm_verdict: farm.verdict,
      model: {
        peer_multiple: priced.multiple,
        multiple_source: "multi",
        category_median: cross.median,
        category_peers: cross.peers,
        terms,
        clamped: priced.clamped,
        age_days: age,
      },
      farm_steps: farmSteps(p, age),
    });
  }
  scored.sort(
    (a, b) =>
      b.implied_value_usd - a.implied_value_usd ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });

  const compact: CompactRow[] = scored.map((row) => ({
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: [...row.chains],
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
    on_watchlist: watchlist.has(row.slug),
  }));

  const liveRows: LiveRow[] = snapshot.protocols
    .filter((p) => exclusionReason(p) === "live token" && p.category !== "CEX")
    .sort((a, b) => {
      const mcapA = a.mcap_usd ?? -1;
      const mcapB = b.mcap_usd ?? -1;
      return mcapB - mcapA || b.tvl_usd - a.tvl_usd;
    })
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d === null ? null : roundTo(p.change_7d, 4),
      mcap_tvl_ratio:
        p.mcap_usd === null || p.tvl_usd <= 0
          ? null
          : roundTo(p.mcap_usd / p.tvl_usd, 3),
    }));

  const totalImplied = scored.reduce((s, r) => s + r.implied_value_usd, 0);
  const totalExpected = scored.reduce((s, r) => s + r.expected_value_usd, 0);
  const byCategory = new Map<string, number>();
  let topCategory: string | null = null;
  let topCategoryImplied = 0;
  for (const row of scored) {
    const c = categoryOf({
      category: row.category,
    } as SnapshotProtocol);
    const sum = (byCategory.get(c) ?? 0) + row.implied_value_usd;
    byCategory.set(c, sum);
    if (sum > topCategoryImplied) {
      topCategoryImplied = sum;
      topCategory = c;
    }
  }
  const sortedOdds = scored.map((r) => r.token_odds).sort((a, b) => a - b);
  const medianOdds =
    sortedOdds.length === 0
      ? 0
      : roundTo(sortedOdds[Math.floor(sortedOdds.length / 2)], 3);
  const verdictCounts: Record<string, number> = { Farm: 0, Thin: 0, Skip: 0 };
  for (const row of scored) verdictCounts[row.farm_verdict]++;

  const radar: Radar = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: scored.length,
    early_size: scored.filter((r) => !watchlist.has(r.slug)).length,
    live_size: liveRows.length,
    comparables: comparables(peers),
    curve,
    fit: {
      coefficients: fit.labels.map((label, i) => ({
        label,
        value: fit.coefficients[i],
      })),
      dummy_categories: fit.dummyCategories,
      n: fit.n,
      r2: fit.r2,
    },
    interval,
    validation,
    odds_bands: odds.bands,
    odds_decay: odds.decay,
    odds_overall: odds.overallRate,
    odds_overall_decay: odds.overallDecay,
    accounting,
    summary: {
      total_implied_usd: totalImplied,
      total_expected_usd: totalExpected,
      top_category: topCategory,
      top_category_implied_usd: topCategoryImplied,
      median_peer_multiple: marketMedian(peers),
      median_token_odds: medianOdds,
      verdict_counts: verdictCounts,
    },
    rows: compact,
    live: liveRows,
  };
  return { rows: scored, radar };
}

// ---- the board gate ----

export function checkBoard(
  snapshot: Snapshot,
  rows: BoardRow[],
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const slugs = new Set(rows.map((r) => r.slug));
  for (const wanted of snapshot.watchlist) {
    if (!slugs.has(wanted)) problems.push(`watchlist slug missing: ${wanted}`);
  }
  for (const p of snapshot.protocols) {
    if (exclusionReason(p) === null && !slugs.has(p.slug)) {
      problems.push(`rankable protocol missing: ${p.slug}`);
    }
  }
  rows.forEach((row, i) => {
    if (row.rank !== i + 1) problems.push(`rank ${row.rank} is not ${i + 1}`);
  });
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].implied_value_usd > rows[i - 1].implied_value_usd) {
      problems.push(`implied value rises at rank ${rows[i].rank}`);
    }
  }
  if (
    rows.length >= 2 &&
    rows[0].implied_value_usd === rows[rows.length - 1].implied_value_usd
  ) {
    problems.push("first and last implied values are equal");
  }
  for (const row of rows) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      problems.push(`${row.slug} has ${row.farm_steps.length} farm steps`);
    }
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) {
        problems.push(`${row.slug} has a farm step of ${step.length} characters`);
      }
    }
    if (
      !Number.isSafeInteger(row.implied_value_usd) ||
      row.implied_value_usd <= 0
    ) {
      problems.push(`${row.slug} implied value is not a positive safe integer`);
    }
    if (
      !Number.isSafeInteger(row.expected_value_usd) ||
      row.expected_value_usd <= 0
    ) {
      problems.push(`${row.slug} expected value is not a positive safe integer`);
    }
    if (
      row.implied_low_usd > row.implied_value_usd ||
      row.implied_high_usd < row.implied_value_usd ||
      row.expected_low_usd > row.expected_value_usd ||
      row.expected_high_usd < row.expected_value_usd
    ) {
      problems.push(`${row.slug} interval misses its point estimate`);
    }
    if (row.token_odds < 0 || row.token_odds > 1) {
      problems.push(`${row.slug} odds outside zero to one`);
    }
    if (!["Farm", "Thin", "Skip"].includes(row.farm_verdict)) {
      problems.push(`${row.slug} verdict is not Farm, Thin or Skip`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---- the dashboard data script ----

export function dataScript(radar: Radar): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
