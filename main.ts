// Token launch radar entry.
//
// Reads the sealed DefiLlama snapshot, builds the ranked board with
// lib/model.ts, writes board.json plus the dashboard data script,
// copies dashboard/ and screenshots/ into the output directory, and
// finishes with the dossier the judge reads.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

function option(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const exact = args.indexOf(`--${name}`);
  if (exact >= 0 && args[exact + 1]) return args[exact + 1]!;
  const joined = args.find((a) => a.startsWith(`--${name}=`));
  return joined ? joined.slice(name.length + 3) : fallback;
}

function copyRegularFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    copied.push(name);
  }
  return copied;
}

const inputOption = option('input', '/input');
const inputFile = inputOption.endsWith('.json') ? inputOption : join(inputOption, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: snapshot missing at ${inputFile}\n`);
  process.exit(2);
}

const outputDir = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue) {
  process.stderr.write(`token radar: board refused locally: ${issue}\n`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

const dashboardFiles = copyRegularFiles(join(repoRoot, 'dashboard'), join(outputDir, 'dashboard'));
if (!dashboardFiles.includes('index.html')) {
  process.stderr.write('token radar: dashboard/index.html missing\n');
  process.exit(1);
}
const screenshots = copyRegularFiles(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
if (screenshots.length < 3 || screenshots.length > 4) {
  process.stderr.write(`token radar: expected 3-4 screenshots, found ${screenshots.length}\n`);
  process.exit(1);
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 65_536,
    screenshots: { max: 4, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

process.stdout.write(
  `token radar: ${radar.totals.board_rows} rows, ${radar.totals.watchlist_covered}/${snapshot.watchlist.length} watchlist covered, ` +
  `${radar.totals.token_trading} token-trading protocols set aside\n`,
);
