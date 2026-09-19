import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Running `tsc` as part of the build.
 *
 * A package that ships types has two emits: the bundlers produce `.mjs`/`.cjs`, and
 * `tsc` produces the `.d.ts` that `exports.types` points at. That left every build
 * script spelling out `tsc -p tsconfig.lib.json && mix-builder`, and the order of those
 * two matters in a way the `&&` hides: `clean` belongs to mix-builder, so a config with
 * `clean: true` wipes the declarations tsc had just written. The failure is quiet, and
 * what it produces is a package whose `types` condition points at a file that is not
 * there.
 *
 * Declaring tsc here puts the sequence in one place that can get it right: clean, then
 * tsc, then the bundlers.
 */
export interface TscConfig {
  /**
   * The tsconfig to build, as a path relative to the package. Defaults to
   * `tsconfig.json`.
   */
  project?: string;
  /** Set false to declare the step and skip it. Defaults to true. */
  enabled?: boolean;
  /** Extra flags, passed through as written. */
  args?: string[];
  /** Emit only declarations, leaving the JS to the bundlers. */
  emitDeclarationOnly?: boolean;
  /** Fail the build when tsc reports errors. Defaults to true. */
  failOnError?: boolean;
}

export interface TscResult {
  ran: boolean;
  ok: boolean;
  /** Why it did not run, when `ran` is false. */
  skipped?: string;
  command?: string;
}

/**
 * The `tsc` executable belonging to the package being built.
 *
 * Resolved from the package rather than from mix-builder's own dependencies, and never
 * from a global install: the compiler that emits a package's declarations has to be the
 * version that package pins, and an ambient `tsc` on PATH is whatever happened to be
 * installed last.
 */
export function resolveTscBin(cwd: string): string | undefined {
  const local = path.join(cwd, 'node_modules', '.bin', 'tsc');
  if (existsSync(local)) return local;

  // pnpm workspaces hoist to the root, so the package's own `.bin` can be absent while
  // `typescript` still resolves. Go through the module rather than guessing upwards.
  try {
    const require = createRequire(path.join(cwd, 'noop.js'));
    const pkgJson = require.resolve('typescript/package.json');
    const bin = path.join(path.dirname(pkgJson), 'bin', 'tsc');
    if (existsSync(bin)) return bin;
  } catch {
    // typescript is not installed here
  }
  return undefined;
}

/** Whether a `tsc` block asks for the step to run at all. */
export function tscApplies(config: TscConfig | undefined): boolean {
  return !!config && config.enabled !== false;
}

/**
 * The argv for the tsc invocation, given a config.
 *
 * Kept separate from running it so the flag assembly is testable without a compiler on
 * disk.
 */
export function tscArgs(config: TscConfig, cwd: string = process.cwd()): string[] {
  const project = config.project ?? 'tsconfig.json';
  const args = ['-p', project];
  if (config.emitDeclarationOnly) args.push('--emitDeclarationOnly');
  if (config.args?.length) args.push(...config.args);
  return args;
}

/**
 * Run tsc for this package, before any bundler.
 *
 * A missing compiler is an error rather than a skip. Declaring the step and silently
 * getting no declarations is the same broken package as the `clean` ordering produced,
 * and it is worth saying so out loud.
 */
export function runTsc(
  config: TscConfig | undefined,
  cwd: string = process.cwd(),
): TscResult {
  if (!tscApplies(config)) return { ran: false, ok: true, skipped: 'not configured' };

  const project = config!.project ?? 'tsconfig.json';
  if (!existsSync(path.resolve(cwd, project))) {
    throw new Error(
      `mix-builder: tsc is configured with project "${project}", which does not exist in ${cwd}.`,
    );
  }

  const bin = resolveTscBin(cwd);
  if (!bin) {
    throw new Error(
      'mix-builder: a `tsc` block is configured but typescript is not installed in this ' +
        'package. Add it as a devDependency, or set `tsc.enabled` to false.',
    );
  }

  const args = tscArgs(config!, cwd);
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit' });

  const ok = result.status === 0;
  if (!ok && (config!.failOnError ?? true)) {
    throw new Error(`mix-builder: tsc exited with ${result.status ?? 'a signal'}.`);
  }
  return { ran: true, ok, command: `tsc ${args.join(' ')}` };
}
