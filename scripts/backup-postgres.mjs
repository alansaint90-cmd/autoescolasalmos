import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const backupDir = process.env.POSTGRES_BACKUP_DIR ?? path.resolve("backups", "postgres");
const retentionDays = Number(process.env.POSTGRES_BACKUP_RETENTION_DAYS ?? 14);

if (!databaseUrl) {
  console.error("[backup-postgres] DATABASE_URL nao configurada.");
  process.exit(1);
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
}

async function runPgDump(outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      outputFile,
      databaseUrl
    ], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`[backup-postgres] pg_dump nao encontrado ou falhou ao iniciar: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`[backup-postgres] pg_dump falhou com codigo ${code}. ${stderr}`));
    });
  });
}

async function pruneOldBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return [];

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = await readdir(backupDir).catch(() => []);
  const removed = [];

  for (const file of files) {
    if (!file.endsWith(".dump")) continue;
    const fullPath = path.join(backupDir, file);
    const info = await stat(fullPath);
    if (info.mtimeMs >= cutoff) continue;

    await rm(fullPath, { force: true });
    removed.push(file);
  }

  return removed;
}

async function main() {
  await mkdir(backupDir, { recursive: true });

  const outputFile = path.join(backupDir, `autoproia-postgres-${timestamp()}.dump`);
  await runPgDump(outputFile);
  const removed = await pruneOldBackups();

  console.log(JSON.stringify({
    ok: true,
    file: outputFile,
    retentionDays,
    removedOldBackups: removed
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
