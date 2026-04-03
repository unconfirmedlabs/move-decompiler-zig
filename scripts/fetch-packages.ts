#!/usr/bin/env bun
/**
 * Fetches all package IDs from Sui mainnet via GraphQL and saves to packages.txt.
 * Then runs the decompiler on every module in every package.
 *
 * Usage:
 *   bun scripts/fetch-packages.ts                    # fetch + decompile all
 *   bun scripts/fetch-packages.ts --fetch-only       # just fetch package IDs
 *   bun scripts/fetch-packages.ts --test-only        # decompile (packages.txt must exist)
 *   bun scripts/fetch-packages.ts --limit 500        # fetch + decompile first 500
 *   bun scripts/fetch-packages.ts --sample 1000      # random sample of 1000 from packages.txt
 */

const GQL_URL = "https://graphql.mainnet.sui.io/graphql";
const PAGE_SIZE = 50;
const PACKAGES_FILE = "packages.txt";
const DECOMPILER = "./zig-out/bin/move-decompile";
const WORK_DIR = "/tmp/decompiler-test-all";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
const fetchOnly = flags.has("--fetch-only");
const testOnly = flags.has("--test-only");

function getNumericArg(name: string): number | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return parseInt(argv[idx + 1], 10);
  return undefined;
}
const limit = getNumericArg("--limit");
const sample = getNumericArg("--sample");

// ── Fetch all package IDs ──────────────────────────────────────────────

async function fetchPackages(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const query = `{ packages(first: ${PAGE_SIZE}${afterClause}) { pageInfo { hasNextPage endCursor } nodes { address } } }`;

    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.error(`GraphQL error: ${res.status} ${res.statusText}`);
      break;
    }

    const json = (await res.json()) as any;
    const data = json.data?.packages;
    if (!data) {
      console.error("Unexpected response:", JSON.stringify(json).slice(0, 200));
      break;
    }

    for (const node of data.nodes) {
      ids.push(node.address);
    }

    page++;
    if (page % 20 === 0) {
      process.stderr.write(`\r  fetched ${ids.length} packages (page ${page})...`);
    }

    if (!data.pageInfo.hasNextPage) break;
    if (limit && ids.length >= limit) break;
    cursor = data.pageInfo.endCursor;
  }

  const result = limit ? ids.slice(0, limit) : ids;
  process.stderr.write(`\r  fetched ${result.length} packages total.          \n`);
  return result;
}

// ── Fetch modules for a single package ─────────────────────────────────

async function fetchModules(
  client: any,
  pkgId: string,
  outDir: string
): Promise<string[]> {
  // Use sui client to get BCS data with module map
  const query = `{ object(address: "${pkgId}") { asMovePackage { modules { nodes { name bytes } } } } }`;

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as any;
  const modules = json.data?.object?.asMovePackage?.modules?.nodes;
  if (!modules || modules.length === 0) return [];

  const names: string[] = [];
  for (const mod of modules) {
    const bytes = Buffer.from(mod.bytes, "base64");
    await Bun.write(`${outDir}/${mod.name}.mv`, bytes);
    names.push(mod.name);
  }
  return names;
}

// ── Decompile all modules in a package ─────────────────────────────────

async function decompilePackage(
  pkgId: string,
  pkgDir: string,
  moduleNames: string[]
): Promise<{ ok: number; fail: number; failures: string[] }> {
  let ok = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const name of moduleNames) {
    const mvPath = `${pkgDir}/${name}.mv`;
    const proc = Bun.spawn([DECOMPILER, mvPath], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode === 0 && stdout.length > 0) {
      ok++;
    } else {
      fail++;
      const reason =
        stderr.trim().split("\n")[0] ||
        (stdout.length === 0 ? "empty output" : `exit ${exitCode}`);
      failures.push(`${pkgId.slice(0, 10)}…::${name} — ${reason}`);
    }
  }

  return { ok, fail, failures };
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Step 1: Fetch or load package IDs
  let packageIds: string[];

  if (testOnly) {
    const file = Bun.file(PACKAGES_FILE);
    if (!(await file.exists())) {
      console.error(`${PACKAGES_FILE} not found. Run without --test-only first.`);
      process.exit(1);
    }
    packageIds = (await file.text())
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    console.log(`Loaded ${packageIds.length} packages from ${PACKAGES_FILE}`);
  } else {
    console.log("Fetching all package IDs from Sui mainnet...");
    packageIds = await fetchPackages();
    await Bun.write(PACKAGES_FILE, packageIds.join("\n") + "\n");
    console.log(`Saved ${packageIds.length} packages to ${PACKAGES_FILE}`);
    if (fetchOnly) return;
  }

  // Apply --sample: random subset
  if (sample && sample < packageIds.length) {
    const shuffled = [...packageIds].sort(() => Math.random() - 0.5);
    packageIds = shuffled.slice(0, sample);
    console.log(`Sampled ${packageIds.length} packages randomly`);
  }

  // Apply --limit on test-only mode
  if (testOnly && limit && limit < packageIds.length) {
    packageIds = packageIds.slice(0, limit);
    console.log(`Limited to first ${packageIds.length} packages`);
  }

  // Step 2: Decompile
  console.log(`\nDecompiling ${packageIds.length} packages...\n`);

  await Bun.spawn(["rm", "-rf", WORK_DIR]).exited;
  await Bun.spawn(["mkdir", "-p", WORK_DIR]).exited;

  let totalModules = 0;
  let totalOk = 0;
  let totalFail = 0;
  const allFailures: string[] = [];
  let pkgCount = 0;
  let pkgOkCount = 0;
  let pkgFailCount = 0;
  let pkgSkipCount = 0;

  // Process in batches to avoid too many concurrent fetches
  const BATCH_SIZE = 10;

  for (let i = 0; i < packageIds.length; i += BATCH_SIZE) {
    const batch = packageIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (pkgId) => {
        const short = pkgId.slice(0, 10) + "…";
        const pkgDir = `${WORK_DIR}/${pkgId.slice(2, 18)}`;
        await Bun.spawn(["mkdir", "-p", pkgDir]).exited;

        let moduleNames: string[];
        try {
          moduleNames = await fetchModules(null, pkgId, pkgDir);
        } catch (e: any) {
          return { short, status: "err" as const, msg: e.message?.slice(0, 60) };
        }

        if (moduleNames.length === 0) {
          return { short, status: "skip" as const, msg: "no modules" };
        }

        const result = await decompilePackage(pkgId, pkgDir, moduleNames);
        return {
          short,
          status: (result.fail > 0 ? "fail" : "ok") as "ok" | "fail",
          moduleCount: moduleNames.length,
          ...result,
        };
      })
    );

    for (const r of results) {
      pkgCount++;
      if (r.status === "skip") {
        pkgSkipCount++;
        continue;
      }
      if (r.status === "err") {
        pkgSkipCount++;
        process.stderr.write(`ERR  ${r.short} — ${r.msg}\n`);
        continue;
      }

      totalModules += r.moduleCount!;
      totalOk += r.ok!;
      totalFail += r.fail!;

      if (r.status === "fail") {
        pkgFailCount++;
        allFailures.push(...r.failures!);
        process.stderr.write(
          `FAIL ${r.short} ${r.moduleCount} modules (${r.ok} ok, ${r.fail} fail)\n`
        );
      } else {
        pkgOkCount++;
      }
    }

    // Progress
    process.stderr.write(
      `\r  ${pkgCount}/${packageIds.length} packages | ${totalModules} modules (${totalOk} ok, ${totalFail} fail)   `
    );
  }

  // Final report
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`RESULTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Packages: ${packageIds.length} total`);
  console.log(`  OK:     ${pkgOkCount}`);
  console.log(`  FAIL:   ${pkgFailCount}`);
  console.log(`  SKIP:   ${pkgSkipCount}`);
  console.log(`Modules:  ${totalModules} total, ${totalOk} ok, ${totalFail} fail`);

  if (allFailures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of allFailures) {
      console.log(`  ${f}`);
    }
  }

  // Exit with error if any failures
  if (totalFail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
