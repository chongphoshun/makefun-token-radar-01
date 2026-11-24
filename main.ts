// Token Radar, radar-6: entrypoint.
// Reads the sealed snapshot, scores the board, writes board.json, data.js and
// dossier.json, and copies the dashboard and screenshots into the output
// directory. The run is deterministic: the same snapshot bytes give the same
// output bytes.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSnapshot,
  buildBoard,
  checkBoard,
  dataScript,
} from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = "/input";
  let output =
    process.env.MAKEFUN_OUTPUT_DIR !== undefined &&
    process.env.MAKEFUN_OUTPUT_DIR !== ""
      ? process.env.MAKEFUN_OUTPUT_DIR
      : "/output";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && i + 1 < argv.length) {
      input = argv[++i];
    } else if (arg.startsWith("--input=")) {
      input = arg.slice("--input=".length);
    } else if (arg === "--output" && i + 1 < argv.length) {
      output = argv[++i];
    } else if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  if (positional.length >= 1) input = positional[0];
  if (positional.length >= 2) output = positional[1];
  return { input, output };
}

function copyTree(sourceDir: string, targetDir: string): string[] {
  mkdirSync(targetDir, { recursive: true });
  const copied: string[] = [];
  const walk = (from: string, to: string) => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fromPath = join(from, entry.name);
      const toPath = join(to, entry.name);
      if (entry.isDirectory()) {
        walk(fromPath, toPath);
      } else if (entry.isFile()) {
        mkdirSync(dirname(toPath), { recursive: true });
        copyFileSync(fromPath, toPath);
        copied.push(toPath);
      }
    }
  };
  walk(sourceDir, targetDir);
  return copied;
}

async function main(): Promise<void> {
  const { input, output } = parseArgs(process.argv.slice(2));
  const snapshotPath = input.endsWith(".json")
    ? input
    : join(input, "snapshot.json");
  if (!existsSync(snapshotPath)) {
    fail(2, `snapshot not found: ${snapshotPath}`);
  }
  let text: string;
  try {
    text = readFileSync(snapshotPath, "utf8");
  } catch (error) {
    fail(2, `cannot read snapshot ${snapshotPath}: ${String(error)}`);
  }
  let snapshot;
  try {
    snapshot = parseSnapshot(text);
  } catch (error) {
    fail(2, `snapshot refused: ${error instanceof Error ? error.message : String(error)}`);
  }
  const { rows, radar } = buildBoard(snapshot);
  const gate = checkBoard(snapshot, rows);
  if (!gate.ok) {
    fail(1, `board gate failed: ${gate.problems.join("; ")}`);
  }

  const outDir = resolve(output);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "board.json"), `${JSON.stringify({ rows })}\n`, "utf8");
  writeFileSync(join(outDir, "data.js"), dataScript(radar), "utf8");

  const dashboardDir = join(HERE, "dashboard");
  const screenshotsDir = join(HERE, "screenshots");
  copyTree(dashboardDir, join(outDir, "dashboard"));
  const screenshots: string[] = [];
  if (existsSync(screenshotsDir)) {
    for (const entry of readdirSync(screenshotsDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isFile()) continue;
      if (!SCREENSHOT_NAME.test(entry.name)) {
        fail(1, `screenshot name refused: ${entry.name}`);
      }
      screenshots.push(entry.name);
    }
    copyTree(screenshotsDir, join(outDir, "screenshots"));
  }
  if (screenshots.length < 3) {
    fail(1, `need at least 3 screenshots, found ${screenshots.length}`);
  }

  const dossier = await buildDossier(outDir, {
    text_max_bytes: 65536,
    screenshot_max_count: 4,
    screenshot_max_bytes: 524288,
    dashboard_max_files: 400,
    dashboard_max_bytes: 4194304,
  });
  writeFileSync(join(outDir, "dossier.json"), dossier);

  const excluded = radar.accounting.total - radar.accounting.ranked;
  const early = radar.early_size;
  const verdicts = radar.summary.verdict_counts;
  console.log(
    `protocols ${radar.accounting.total} watchlist ${radar.watchlist_size} rows ${rows.length} early ${early} excluded ${excluded}`,
  );
  console.log(
    `total implied ${radar.summary.total_implied_usd} total expected ${radar.summary.total_expected_usd} verdicts Farm ${verdicts.Farm} Thin ${verdicts.Thin} Skip ${verdicts.Skip}`,
  );
  console.log(
    `fit n ${radar.fit.n} r2 ${radar.fit.r2} q90 ${radar.interval.q90} coverage ${radar.interval.coverage} loo multi ${radar.validation.loo.multi} flat ${radar.validation.loo.flat}`,
  );
  console.log(
    `wrote ${join(outDir, "board.json")} ${join(outDir, "data.js")} ${join(outDir, "dossier.json")} dashboard/ (${basename(dashboardDir)}) screenshots/ (${screenshots.length} files)`,
  );
}

main();
