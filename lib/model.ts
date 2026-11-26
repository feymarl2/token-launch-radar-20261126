// Token launch radar model.
//
// The sealed snapshot is the only input. A protocol is treated as
// "records no token" only when DefiLlama carries neither a Gecko id
// nor a symbol for it. The board always covers the house watchlist,
// then adds the strongest other tokenless protocols that survive a
// stricter derivative screen. Implied value is a transparent launch
// FDV proxy, not a prediction that a token will exist.

export interface Protocol {
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
  source?: unknown;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  status: string;
  confidence: number;
  score: number;
  multiple: number;
  factors: {
    momentum: number;
    age: number;
    breadth: number;
    confidence: number;
  };
  drivers: string[];
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  totals: {
    protocols: number;
    tokenless: number;
    token_trading: number;
    derivative_excluded: number;
    board_rows: number;
    watchlist_covered: number;
  };
  methodology: string[];
  assumptions: string[];
  rows: BoardRow[];
}

const BOARD_SIZE = 220;
const DERIVATIVE_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
  'Anchor BTC',
  'Decentralized BTC',
  'Stablecoin Wrapper',
]);
const EXCHANGE_PREFIXES = [
  'binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx',
  'bitfinex', 'gemini', 'kucoin', 'htx', 'crypto-com', 'bitstamp',
];
const CATEGORY_MULTIPLES: Record<string, number> = {
  'Chain': 2.35,
  'Dexs': 1.85,
  'Derivatives': 1.55,
  'Prediction Market': 1.45,
  'Lending': 1.22,
  'Uncollateralized Lending': 1.15,
  'CDP': 0.82,
  'Basis Trading': 0.92,
  'Yield': 0.78,
  'Yield Aggregator': 0.72,
  'Farm': 0.68,
  'Leveraged Farming': 0.74,
  'Liquidity Manager': 0.9,
  'Collateral Markets': 1.05,
  'Restaking': 0.66,
  'Staking Pool': 0.58,
  'RWA': 0.52,
  'CeDeFi': 0.48,
  'Risk Curators': 0.34,
  'Onchain Capital Allocator': 0.46,
  'Governance Incentives': 0.62,
  'Insurance': 0.55,
  'Payments': 0.7,
  'Dual-Token Stablecoin': 0.6,
  'Interest Rate Derivatives': 1.1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseSnapshot(raw: string): Snapshot {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed.protocols) || !Array.isArray(parsed.watchlist)) {
    throw new Error('snapshot does not carry protocols and watchlist arrays');
  }
  const protocols = parsed.protocols.map((item) => {
    if (!isRecord(item)) throw new Error('snapshot protocol is not an object');
    const slug = text(item.slug);
    const name = text(item.name);
    if (!slug || !name) throw new Error('snapshot protocol lacks slug or name');
    return {
      slug,
      name,
      category: text(item.category),
      chains: Array.isArray(item.chains) ? item.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: Math.max(0, Math.trunc(numberOrNull(item.tvl_usd) ?? 0)),
      change_7d: numberOrNull(item.change_7d),
      mcap_usd: numberOrNull(item.mcap_usd),
      listed_at: text(item.listed_at),
      gecko_id: text(item.gecko_id),
      symbol: text(item.symbol),
    } satisfies Protocol;
  });
  return {
    as_of: text(parsed.as_of) ?? 'snapshot date not stated',
    source: parsed.source,
    floor_usd: Math.trunc(numberOrNull(parsed.floor_usd) ?? 50_000_000),
    protocols,
    watchlist: parsed.watchlist.filter((s): s is string => typeof s === 'string'),
  };
}

function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

function derivativeLike(p: Protocol): boolean {
  const category = p.category ?? '';
  if (DERIVATIVE_CATEGORIES.has(category)) return true;
  const name = p.name.toLowerCase();
  if (/\b(wrapped|staked|staking|restaked|bridge)\b/.test(name)) return true;
  if (EXCHANGE_PREFIXES.some((prefix) => name === prefix || name.startsWith(`${prefix} `) || name.startsWith(`${prefix}-`))) return true;
  if (/\s(v\d+(?:\.\d+)?|\d+\.\d+)$/i.test(p.name.trim())) return true;
  return false;
}

function ageDays(p: Protocol, asOf: string): number | null {
  if (!p.listed_at) return null;
  const start = Date.parse(`${p.listed_at}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function categoryMultiple(category: string): number {
  return CATEGORY_MULTIPLES[category] ?? 0.82;
}

function momentumFactor(change7d: number | null): number {
  if (change7d === null) return 1;
  return 1 + clamp(change7d, -35, 35) / 250;
}

function ageFactor(age: number | null): number {
  if (age === null) return 0.96;
  if (age < 60) return 1.1;
  if (age < 180) return 1.05;
  if (age < 365) return 1;
  if (age < 1095) return 0.94;
  return 0.86;
}

function breadthFactor(chains: string[]): number {
  return 1 + Math.min(Math.max(chains.length - 1, 0), 10) * 0.012;
}

function confidenceFactor(p: Protocol, watchlisted: boolean): number {
  if (watchlisted) return 1;
  if (p.tvl_usd >= 50_000_000) return 0.98;
  if (p.tvl_usd >= 20_000_000) return 0.95;
  return 0.92;
}

function money(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function actionFor(category: string): string {
  if (category === 'Dexs') return 'make a small swap, add a tiny two-sided liquidity position only if the pool is deep, then remove it once to learn the full flow';
  if (category === 'Lending' || category === 'Uncollateralized Lending') return 'supply a small amount of a major asset, borrow far below the liquidation line only if needed, then repay and withdraw once';
  if (category === 'Derivatives' || category === 'Basis Trading' || category === 'Interest Rate Derivatives') return 'open the smallest permitted position with a hard stop, close it the same day, and repeat only at a size you can afford to lose';
  if (category === 'RWA' || category === 'CeDeFi') return 'read the eligibility and custody terms first, complete any required identity check only on the official flow, then start with the minimum allocation';
  if (category === 'Chain') return 'bridge a small amount through the official route, make one low-value transaction, and keep enough native gas for the return trip';
  if (category === 'Risk Curators' || category === 'Onchain Capital Allocator') return 'choose one transparent vault, deposit a test amount, record the curator and underlying market, then withdraw once before sizing up';
  if (category === 'CDP' || category === 'Dual-Token Stablecoin') return 'mint or hold only a small amount, keep collateral well above the minimum, and test redemption before adding size';
  if (category === 'Prediction Market') return 'place one minimum-size position on a market you understand, settle it fully, and avoid chasing thin books';
  if (category === 'Restaking' || category === 'Staking Pool' || category === 'Collateral Markets') return 'stake or deposit a test amount, note the withdrawal delay in writing, and complete one exit before committing more';
  return 'complete the smallest real product action available, then repeat it once after a week so the wallet shows sustained use rather than one click';
}

function farmSteps(p: Protocol): string[] {
  const category = p.category ?? 'Uncategorised';
  const chain = p.chains[0] ?? 'its main chain';
  const size = p.tvl_usd >= 250_000_000 ? '$100-$500 core budget after a $5-$25 test' : '$25-$150 core budget after a $5-$15 test';
  return [
    `Verify ${p.name} from its DefiLlama protocol page and the official links it names; budget 10 minutes and do not use search ads or copied app links.`,
    `Prepare a clean wallet on ${chain} with gas plus a ${size}; keep the first transaction small enough that a total loss would not change your week.`,
    `In the ${category} flow, ${actionFor(category)}; allow 20-40 minutes for the first full cycle including approvals and exit.`,
    'Record the date, transaction hash, amount, fees and any points or claim shown by the app; spend 5 minutes weekly checking that balances and positions still match.',
    'Repeat a modest real action every 7-14 days for 6-8 weeks, vary the amount slightly, and stop adding if TVL falls 30% in a week or the official terms change.',
    'Before any launch claim, re-check the official announcement, contract address and eligibility rules; never pay a claim fee or sign a message from an unofficial link.',
  ];
}

interface Scored {
  p: Protocol;
  watchlisted: boolean;
  implied: number;
  score: number;
  multiple: number;
  factors: BoardRow['factors'];
  age: number | null;
}

function scoreProtocol(p: Protocol, snapshot: Snapshot, watchlisted: boolean): Scored {
  const category = p.category ?? 'Uncategorised';
  const multiple = categoryMultiple(category);
  const age = ageDays(p, snapshot.as_of);
  const factors = {
    momentum: round2(momentumFactor(p.change_7d)),
    age: round2(ageFactor(age)),
    breadth: round2(breadthFactor(p.chains)),
    confidence: round2(confidenceFactor(p, watchlisted)),
  };
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * factors.momentum * factors.age * factors.breadth * factors.confidence));
  const tvlScore = clamp((Math.log10(Math.max(p.tvl_usd, 1)) - 6.7) * 28, 0, 100);
  const momentumScore = p.change_7d === null ? 50 : clamp(50 + p.change_7d * 1.2, 0, 100);
  const ageScore = age === null ? 55 : age < 180 ? 78 : age < 730 ? 68 : 52;
  const score = Math.round(tvlScore * 0.58 + momentumScore * 0.2 + ageScore * 0.12 + Math.min(p.chains.length, 10) * 1);
  return { p, watchlisted, implied, score: clamp(score, 1, 100), multiple, factors, age };
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const watch = new Set(snapshot.watchlist);
  const tokenless = snapshot.protocols.filter(recordsNoToken);
  const derivativeExcluded = tokenless.filter((p) => !watch.has(p.slug) && derivativeLike(p)).length;
  const scored = tokenless
    .filter((p) => watch.has(p.slug) || (p.tvl_usd < snapshot.floor_usd && !derivativeLike(p)))
    .map((p) => scoreProtocol(p, snapshot, watch.has(p.slug)))
    .sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || a.p.slug.localeCompare(b.p.slug));

  const selected: Scored[] = [];
  const seen = new Set<string>();
  for (const item of scored.filter((x) => x.watchlisted)) {
    selected.push(item);
    seen.add(item.p.slug);
  }
  for (const item of scored) {
    if (selected.length >= BOARD_SIZE) break;
    if (!seen.has(item.p.slug)) {
      selected.push(item);
      seen.add(item.p.slug);
    }
  }
  selected.sort((a, b) => b.implied - a.implied || b.score - a.score || a.p.slug.localeCompare(b.p.slug));

  const rows = selected.map((item, index): BoardRow => {
    const p = item.p;
    const category = p.category ?? 'Uncategorised';
    const drivers = [
      `${money(p.tvl_usd)} TVL anchors the estimate at a ${item.multiple.toFixed(2)}x ${category} multiple.`,
      p.change_7d === null ? 'Seven-day TVL change is unreported, so momentum is neutral.' : `Seven-day TVL change is ${p.change_7d.toFixed(1)}%, giving a ${item.factors.momentum.toFixed(2)}x momentum factor.`,
      item.age === null ? 'DefiLlama gives no listing date, so tokenless age is discounted slightly.' : `${item.age} days tracked with no token recorded, giving a ${item.factors.age.toFixed(2)}x age factor.`,
      `${p.chains.length} chain${p.chains.length === 1 ? '' : 's'} listed, giving a ${item.factors.breadth.toFixed(2)}x breadth factor.`,
    ];
    return {
      slug: p.slug,
      name: p.name,
      rank: index + 1,
      implied_value_usd: item.implied,
      farm_steps: farmSteps(p),
      category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: item.age,
      status: item.watchlisted ? 'Watchlist' : 'Early radar',
      confidence: Math.round(item.factors.confidence * 100),
      score: item.score,
      multiple: item.multiple,
      factors: item.factors,
      drivers,
    };
  });

  const radar: Radar = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    totals: {
      protocols: snapshot.protocols.length,
      tokenless: tokenless.length,
      token_trading: snapshot.protocols.length - tokenless.length,
      derivative_excluded: derivativeExcluded,
      board_rows: rows.length,
      watchlist_covered: rows.filter((r) => watch.has(r.slug)).length,
    },
    methodology: [
      'Implied FDV = TVL x category multiple x momentum x tokenless-age x chain-breadth x confidence.',
      'Momentum clamps seven-day TVL change to -35%..+35%; missing change is neutral.',
      'Age rewards recently tracked protocols modestly and discounts very old tokenless records; missing dates are discounted.',
      'Risk Curators and allocators use low multiples because their TVL is largely third-party capital they direct, not assets they own.',
    ],
    assumptions: [
      'Records no token means DefiLlama carries neither a Gecko id nor a symbol; it is not proof that no token exists anywhere.',
      'Token-trading protocols are set aside from the launch board and counted separately in the header.',
      'Farm plans are category-level operating plans, not promises of an airdrop or eligibility.',
    ],
    rows,
  };
  return { board: rows, radar };
}

export function boardIssue(rows: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  if (rows.length < 100 || rows.length > 4000) return `board holds ${rows.length} rows`;
  const seen = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  for (const [index, row] of rows.entries()) {
    if (row.rank !== index + 1) return `rank sequence breaks at ${row.slug}`;
    if (!slugs.has(row.slug) || seen.has(row.slug)) return `slug is invented or repeated: ${row.slug}`;
    seen.add(row.slug);
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd <= 0) return `bad implied value: ${row.slug}`;
    if (row.implied_value_usd > previous) return `implied value rises at ${row.slug}`;
    previous = row.implied_value_usd;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `farm steps count: ${row.slug}`;
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `farm step length ${len}: ${row.slug}`;
    }
  }
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) return `watchlist slug missing: ${slug}`;
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) return 'all implied values are the same';
  return null;
}

export function dataScript(radar: Radar): string {
  return `window.RADAR_DATA=${JSON.stringify(radar).replaceAll('<', '\\u003c')};\n`;
}
