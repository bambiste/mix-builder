import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

/** True when running inside GitHub Actions / a generic CI environment. */
export function isCI(): boolean {
  return process.env['GITHUB_ACTIONS'] === 'true' || !!process.env['CI'];
}

/** True when we can prompt the user (a real TTY, not CI). */
export function isInteractive(): boolean {
  return !isCI() && !!process.stdout.isTTY && !!process.stdin.isTTY;
}

/**
 * Derive the secret suffix from an env file name:
 *   .env          -> DEFAULT
 *   .env.prod     -> PROD
 *   .env.staging  -> STAGING
 */
export function suffixFromEnvFile(name: string): string {
  const base = path.basename(name);
  const m = /^\.env(?:\.(.+))?$/.exec(base);
  const part = m?.[1] ?? 'default';
  return part.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/** Token for a package directory, e.g. "store-admin" -> "STORE_ADMIN". */
export function pkgToken(dir: string): string {
  const base = path.basename(path.resolve(dir));
  return base.toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'ROOT';
}

/** Secret name for a given package dir + env file, e.g. BACKEND_ENV_PROD. */
export function secretNameFor(dir: string, envFileName: string): string {
  return `${pkgToken(dir)}_ENV_${suffixFromEnvFile(envFileName)}`;
}

export interface EnvMatch {
  /** Absolute path of the env file. */
  file: string;
  /** Path relative to cwd, for display. */
  rel: string;
  /** GitHub secret name. */
  secretName: string;
  /** The env file's base name, e.g. ".env.prod". */
  envFileName: string;
}

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.medusa/**',
  '**/.git/**',
];

/**
 * Find env files matching `envFileName` (e.g. ".env.prod") anywhere in the
 * workspace (root + nested packages), excluding build/dependency dirs.
 */
export async function findEnvFiles(
  envFileName: string,
  cwd = process.cwd()
): Promise<EnvMatch[]> {
  const files = await fg([`**/${envFileName}`, envFileName], {
    cwd,
    dot: true,
    absolute: true,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
    unique: true,
  });
  return files.sort().map((file) => {
    const dir = path.dirname(file);
    return {
      file,
      rel: path.relative(cwd, file) || path.basename(file),
      secretName: secretNameFor(dir, envFileName),
      envFileName: path.basename(file),
    };
  });
}

/** Discover workspace package directories (relative to cwd). */
export async function findPackageDirs(cwd = process.cwd()): Promise<string[]> {
  const pkgs = await fg(['packages/*/package.json', 'package.json'], {
    cwd,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
  });
  return pkgs.map((p) => path.dirname(path.resolve(cwd, p)));
}

/** Detect "owner/repo" from the git origin remote. */
export function detectRepo(cwd = process.cwd()): string | null {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Set a single GitHub Actions secret via the `gh` CLI (value passed on stdin). */
export function ghSecretSet(
  name: string,
  value: string,
  repo: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['secret', 'set', name, '--repo', repo], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`gh secret set ${name} exited with code ${code}`))
    );
    child.stdin.write(value);
    child.stdin.end();
  });
}

/**
 * PUSH: upload each matched env file as a base64-encoded GitHub secret.
 * Returns the secret names that were set.
 */
export async function pushEnvFiles(
  matches: EnvMatch[],
  repo: string
): Promise<string[]> {
  const set: string[] = [];
  for (const m of matches) {
    const content = await readFile(m.file);
    await ghSecretSet(m.secretName, content.toString('base64'), repo);
    set.push(m.secretName);
  }
  return set;
}

export interface PullResult {
  file: string;
  secretName: string;
}

/**
 * PULL: for each workspace package, if its secret env var is present in
 * `process.env` (injected by CI / forwarded to a VPS), decode it and write the
 * env file back to disk (mode 600). Returns what was written/skipped.
 */
export async function pullEnvFiles(
  envFileName: string,
  opts: {
    cwd?: string;
    dryRun?: boolean;
    /** Overwrite the target file if it already exists. Default: false (skip). */
    force?: boolean;
    /** Output file name to write (default: same as `envFileName`). */
    outFileName?: string;
  } = {}
): Promise<{ written: PullResult[]; skipped: string[]; existing: string[] }> {
  const cwd = opts.cwd ?? process.cwd();
  const outName = opts.outFileName ?? envFileName;
  const dirs = await findPackageDirs(cwd);
  const written: PullResult[] = [];
  const skipped: string[] = []; // no secret var present
  const existing: string[] = []; // target file already exists, not overwritten
  for (const dir of dirs) {
    const secretName = secretNameFor(dir, envFileName);
    const value = process.env[secretName];
    const target = path.join(dir, outName);
    const rel = path.relative(cwd, target) || target;
    if (!value) {
      skipped.push(secretName);
      continue;
    }
    if (!opts.force && existsSync(target)) {
      existing.push(rel);
      continue;
    }
    if (!opts.dryRun) {
      const content = Buffer.from(value, 'base64').toString('utf8');
      await writeFile(target, content);
      await chmod(target, 0o600);
    }
    written.push({ file: rel, secretName });
  }
  return { written, skipped, existing };
}

/** Known env "types" mapped to their file name. Custom types are also allowed. */
export const ENV_TYPES: Record<string, string> = {
  development: '.env.dev',
  production: '.env.prod',
};
