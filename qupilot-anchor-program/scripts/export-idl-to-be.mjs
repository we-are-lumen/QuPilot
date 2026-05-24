import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const anchorRoot = path.resolve(process.cwd());
const srcIdl = path.resolve(anchorRoot, "target/idl/qupilot.json");
const srcTypes = path.resolve(anchorRoot, "target/types/qupilot.ts");

const repoRoot = path.resolve(anchorRoot, "..");
const destIdl = path.resolve(repoRoot, "qupilot-be/src/lib/solana/idl/qupilot.json");
const destTypes = path.resolve(repoRoot, "qupilot-be/src/lib/solana/types/qupilot.ts");

async function ensureExists(p) {
  try {
    await fs.access(p);
  } catch {
    throw new Error(`Missing file: ${p}`);
  }
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function main() {
  await ensureExists(srcIdl);
  await ensureExists(srcTypes);
  await copyFile(srcIdl, destIdl);
  await copyFile(srcTypes, destTypes);
  process.stdout.write(`Exported:\n- ${destIdl}\n- ${destTypes}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

