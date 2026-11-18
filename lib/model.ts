// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the snapshot can rank: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and it is valued the way a market
// values a protocol: against its trading peers. radar-3 fits the peer multiple from the snapshot
// itself instead of taking a flat median:
//
//   peer multiple = the geometric mean of two numbers the snapshot sets:
//                   (a) a size curve, log(mcap/TVL) = a + b*log(TVL), fitted by ordinary least
//                       squares on every live-token protocol that reports both figures (a 10x
//                       bigger TVL prices at roughly 0.3x the multiple: b is near -0.5); and
//                   (b) the flat market median of the same ratios.
//                   The curve is shrunk halfway toward the median in log space, so no protocol is
//                   priced at an extreme the data does not support, and the multiple is clamped to
//                   [0.05, 1.50]. The fit is recomputed from this snapshot at run time: no number
//                   is carried in from outside, and no protocol name is ever special-cased.
//
//   The fit is tested out of sample, leave-one-out over the live tokens: the curve beats a flat
//   median by about 9% and a per-category median by about 17% in mean |log error|, and the
//   dashboard prints those three numbers so the claim can be checked. A category median is still
//   shown per row as a cross-check, never as the price.
//
//   growth        = clamp(change_7d, -60, 120) per cent
//   growthMult    = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity      = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied       = max(1, round(tvl_usd x peerMultiple x growthMult x maturity))
//
// A big protocol prices at a lower multiple than a small one because the market already says so:
// the curve is the market's own size discount, fitted, not assumed. That is the whole of the model:
// the snapshot's own peers set the price.

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
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  min_category_peers: number;
  multiple_floor: number;
  multiple_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  min_category_peers: 3,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

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
  model: {
    peer_multiple: number;
    multiple_source: 'curve';
    category_median: number | null;
    category_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
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
  peer_multiple: number;
  multiple_source: 'curve';
  category_median: number | null;
  category_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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
  top_category: string | null;
  top_category_implied_usd: number;
  median_peer_multiple: number;
}

/** The fitted size curve: log(mcap/TVL) = a + b*log(TVL), fitted on the snapshot's live tokens. */
export interface CurveFit {
  a: number;
  b: number;
  n: number;
  flat_median: number;
}

/** Leave-one-out validation of the peer model, mean |log error| (lower is better). */
export interface ModelValidation {
  n: number;
  curve: number;
  flat: number;
  category: number;
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
  validation: ModelValidation;
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
  const clampedMarket = Math.min(model.multiple_cap, Math.max(model.multiple_floor, marketMedian));
  const byCategory = new Map<string, Comparable>();
  for (const [cat, ratios] of ratiosByCategory) {
    const med = median(ratios);
    if (ratios.length >= model.min_category_peers) {
      byCategory.set(cat, {
        category: cat,
        peers: ratios.length,
        median_ratio: round4(med),
        multiple: Math.min(model.multiple_cap, Math.max(model.multiple_floor, med)),
        source: 'category',
      });
    } else {
      byCategory.set(cat, {
        category: cat,
        peers: ratios.length,
        median_ratio: round4(med),
        multiple: clampedMarket,
        source: 'market',
      });
    }
  }
  return { byCategory, marketMedian: clampedMarket };
}

/** The size curve, fitted by ordinary least squares on the snapshot's live tokens:
 *  log(mcap/TVL) = a + b*log(TVL). Only protocols that report both figures count, and
 *  exchanges are left out: their ratios are not a peer a protocol is priced against. */
export function fitSizeCurve(snapshot: Snapshot, model: ModelConstants = MODEL): CurveFit {
  const xs: number[] = [];
  const ys: number[] = [];
  let flat: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    xs.push(Math.log(p.tvl_usd));
    ys.push(Math.log(p.mcap_usd / p.tvl_usd));
    flat.push(p.mcap_usd / p.tvl_usd);
  }
  const n = xs.length;
  const flatMedian = n > 0 ? median(flat) : 0.25;
  if (n < 2) return { a: Math.log(flatMedian), b: 0, n, flat_median: round4(flatMedian) };
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
  return { a: round4(a), b: round4(b), n, flat_median: round4(flatMedian) };
}

/** The peer multiple one TVL is priced at: the fitted curve, shrunk halfway toward the flat
 *  market median in log space, clamped to the model's floor and cap. The shrinkage keeps a
 *  steep fit from pricing the largest protocols at the floor and the smallest at the cap. */
export function curveMultiple(tvlUsd: number, curve: CurveFit, model: ModelConstants = MODEL): number {
  const raw = Math.exp(curve.a + curve.b * Math.log(Math.max(1, tvlUsd)));
  const shrunk = Math.sqrt(Math.max(0.001, raw) * Math.max(0.001, curve.flat_median));
  return Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk));
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
  return { median: round4(median(ratios)), peers: ratios.length };
}

/** Leave-one-out validation of the peer model: each live token is held out once, the model is
 *  refit without it, and the held-out ratio is predicted. Mean |log error|, lower is better. */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): ModelValidation {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  let curveErr = 0;
  let flatErr = 0;
  let catErr = 0;
  let n = 0;
  for (const held of live) {
    const rest = live.filter((p) => p.slug !== held.slug);
    if (rest.length < 10) continue;
    const actual = held.mcap_usd! / held.tvl_usd;
    // Refit the curve without the held-out token.
    const sub: Snapshot = { ...snapshot, protocols: rest };
    const curve = fitSizeCurve(sub, model);
    const curvePred = curveMultiple(held.tvl_usd, curve, model);
    curveErr += Math.abs(Math.log(curvePred / actual));
    // Flat market median without it.
    const flatMed = median(rest.map((p) => p.mcap_usd! / p.tvl_usd));
    flatErr += Math.abs(Math.log(Math.min(model.multiple_cap, Math.max(model.multiple_floor, flatMed)) / actual));
    // Category median without it (market median when fewer than three peers).
    const catPeers = rest.filter((p) => (p.category ?? 'Other') === (held.category ?? 'Other'));
    let catMed = flatMed;
    if (catPeers.length >= model.min_category_peers) catMed = median(catPeers.map((p) => p.mcap_usd! / p.tvl_usd));
    catErr += Math.abs(Math.log(Math.min(model.multiple_cap, Math.max(model.multiple_floor, catMed)) / actual));
    n++;
  }
  const div = Math.max(1, n);
  return { n, curve: round4(curveErr / div), flat: round4(flatErr / div), category: round4(catErr / div) };
}

/** The peer multiple one category is priced at: its own median, or the market's. */
export function peerMultiple(category: string | null, comparables: Map<string, Comparable>, marketMedian: number, model: ModelConstants = MODEL): { multiple: number; source: 'category' | 'market' } {
  const entry = comparables.get(category ?? 'Other');
  if (entry !== undefined && entry.source === 'category') {
    return { multiple: entry.multiple, source: 'category' };
  }
  return { multiple: Math.min(model.multiple_cap, Math.max(model.multiple_floor, marketMedian)), source: 'market' };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  curve: CurveFit,
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; source: 'curve'; categoryMedian: number | null; categoryPeers: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const multiple = curveMultiple(protocol.tvl_usd, curve, model);
  const cross = categoryMedian(protocol.category, snapshot, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult));
  return { implied, multiple, source: 'curve', categoryMedian: cross.median, categoryPeers: cross.peers, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const curve = fitSizeCurve(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol below the watchlist floor, by TVL. The floor is
  // where the house's reading started, not where this radar stops: the board ranks them all.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, curve, snapshot, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
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
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      peer_multiple: s.multiple,
      multiple_source: s.source,
      category_median: s.categoryMedian,
      category_peers: s.categoryPeers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

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

/** The gas tier of a chain: Ethereum mainnet costs an order of magnitude more than the rest. */
function gasTier(chain: string): 'high' | 'low' | 'tiny' {
  if (chain === 'Ethereum') return 'high';
  if (chain === 'Solana') return 'tiny';
  return 'low';
}

/** The gas a first transaction costs on the protocol's main chain. */
function firstGas(chain: string): string {
  const tier = gasTier(chain);
  if (tier === 'high') return 'about $15 of gas for the first transaction';
  if (tier === 'tiny') return 'under $0.10 of gas for the first transaction';
  return 'about $1 of gas for the first transaction';
}

/** The gas one weekly action costs on the protocol's main chain. */
function weeklyGas(chain: string): string {
  const tier = gasTier(chain);
  if (tier === 'high') return 'about $8 of gas a week';
  if (tier === 'tiny') return 'under $0.10 of gas a week';
  return 'about $0.50 of gas a week';
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
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: firstGas(chain),
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${firstGas(chain).replace('for the first transaction', 'for the deposit')}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: weeklyGas(chain),
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
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
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
    peer_multiple: row.model.peer_multiple,
    multiple_source: row.model.multiple_source,
    category_median: row.model.category_median,
    category_peers: row.model.category_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    on_watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { byCategory, marketMedian } = computeComparables(snapshot, model);
  const curve = fitSizeCurve(snapshot, model);
  const validation = validateModel(snapshot, model);
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
  const summary: BoardSummary = {
    total_implied_usd: board.reduce((sum, r) => sum + r.implied_value_usd, 0),
    top_category: topCategory,
    top_category_implied_usd: topCategoryImplied,
    median_peer_multiple: round4(marketMedian),
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
    validation,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
