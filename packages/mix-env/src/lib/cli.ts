#!/usr/bin/env node
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  ENV_TYPES,
  detectRepo,
  findEnvFiles,
  isInteractive,
  pullEnvFiles,
  pushEnvFiles,
} from './core.js';

interface Flags {
  _: string[];
  type?: string;
  file?: string;
  repo?: string;
  out?: string;
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') flags.yes = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--dry-run' || a === '-n') flags.dryRun = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--type' || a === '-t') flags.type = argv[++i];
    else if (a === '--file' || a === '-f') flags.file = argv[++i];
    else if (a === '--repo' || a === '-r') flags.repo = argv[++i];
    else if (a === '--out' || a === '-o') flags.out = argv[++i];
    else if (a && a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (k === 'type') flags.type = v;
      else if (k === 'file') flags.file = v;
      else if (k === 'repo') flags.repo = v;
      else if (k === 'out') flags.out = v;
    } else if (a) flags._.push(a);
  }
  return flags;
}

const HELP = `${chalk.bold('mix-env')} — sync .env files <-> GitHub Actions secrets

${chalk.bold('Usage')}
  mix-env push [options]    Upload matching .env files as GitHub secrets
  mix-env pull [options]    Recreate .env files from secret env vars (CI / VPS)

${chalk.bold('Options')}
  -t, --type <name>   Env type: production | development | <custom>
  -f, --file <name>   Explicit env file name (e.g. .env.staging). Overrides --type
  -r, --repo <o/r>    Target repo for push (default: git origin)
  -o, --out <name>    Output file name for pull (default: same as the source)
      --force         Overwrite existing files on pull (default: skip them)
  -y, --yes           Skip confirmation
  -n, --dry-run       Show what would happen without making changes
  -h, --help          Show this help

${chalk.bold('Secrets')} are named ${chalk.cyan('<PACKAGE>_ENV_<TYPE>')} (e.g. ${chalk.cyan('BACKEND_ENV_PROD')}),
each holding the base64 of one env file.

${chalk.bold('Examples')}
  mix-env push --type production         # packages/*/.env.prod -> secrets
  mix-env pull --type production         # secrets (env vars) -> packages/*/.env.prod
`;

async function resolveEnvFile(flags: Flags, interactive: boolean): Promise<string> {
  if (flags.file) return flags.file;
  if (flags.type) return ENV_TYPES[flags.type] ?? `.env.${flags.type}`;
  if (!interactive) {
    throw new Error('Specify --type <production|development|...> or --file <name>');
  }
  const { choice } = await inquirer.prompt<{ choice: string }>([
    {
      type: 'list',
      name: 'choice',
      message: 'Which environment?',
      choices: [
        { name: 'Production  (.env.prod)', value: 'production' },
        { name: 'Development (.env.dev)', value: 'development' },
        { name: 'Plain       (.env)', value: 'plain' },
        { name: 'Custom…', value: 'custom' },
      ],
    },
  ]);
  if (choice === 'plain') return '.env';
  if (choice === 'custom') {
    const { file } = await inquirer.prompt<{ file: string }>([
      { type: 'input', name: 'file', message: 'Env file name:', default: '.env.staging' },
    ]);
    return file;
  }
  return ENV_TYPES[choice]!;
}

async function runPush(flags: Flags): Promise<number> {
  const interactive = isInteractive();
  const envFile = await resolveEnvFile(flags, interactive);
  const matches = await findEnvFiles(envFile);
  if (matches.length === 0) {
    console.error(chalk.yellow(`No "${envFile}" files found in this workspace.`));
    return 1;
  }
  const repo = flags.repo ?? detectRepo();
  if (!repo) {
    console.error(chalk.red('Could not determine the GitHub repo. Pass --repo owner/name.'));
    return 1;
  }

  console.log(chalk.bold(`\nPushing ${matches.length} "${envFile}" file(s) to ${chalk.cyan(repo)}:\n`));
  for (const m of matches) {
    console.log(`  ${chalk.dim(m.rel)}  ${chalk.dim('→')}  ${chalk.cyan(m.secretName)}`);
  }
  console.log();

  if (flags.dryRun) {
    console.log(chalk.dim('(dry run — no secrets were set)'));
    return 0;
  }

  if (interactive && !flags.yes) {
    const { ok } = await inquirer.prompt<{ ok: boolean }>([
      { type: 'confirm', name: 'ok', message: `Create/update these ${matches.length} secret(s)?`, default: true },
    ]);
    if (!ok) {
      console.log(chalk.dim('Aborted.'));
      return 0;
    }
  }

  const set = await pushEnvFiles(matches, repo);
  console.log(chalk.green(`\n✓ Set ${set.length} secret(s) on ${repo}.`));
  return 0;
}

async function runPull(flags: Flags): Promise<number> {
  const envFile = await resolveEnvFile(flags, isInteractive());
  const outName = flags.out ?? envFile;
  const { written, skipped, existing } = await pullEnvFiles(envFile, {
    dryRun: flags.dryRun,
    force: flags.force,
    outFileName: flags.out,
  });

  if (written.length === 0) {
    if (existing.length > 0) {
      console.log(
        chalk.yellow(
          `\nNothing written — ${existing.length} target file(s) already exist. Use --force to overwrite:`
        )
      );
      for (const e of existing) console.log(`  ${chalk.dim(e)}`);
      console.log();
      return 0;
    }
    console.error(
      chalk.yellow(
        `No matching secret env vars found for "${envFile}".\n` +
          `Expected vars like ${chalk.cyan('BACKEND_ENV_' + envFile.replace(/^\.env\.?/, '').toUpperCase())} in the environment.`
      )
    );
    if (skipped.length) console.error(chalk.dim(`Checked: ${skipped.join(', ')}`));
    return 1;
  }

  const verb = flags.dryRun ? 'Would write' : 'Wrote';
  console.log(chalk.bold(`\n${verb} ${written.length} "${outName}" file(s):\n`));
  for (const w of written) {
    console.log(`  ${chalk.cyan(w.secretName)}  ${chalk.dim('→')}  ${chalk.green(w.file)}`);
  }
  if (existing.length > 0) {
    console.log(chalk.dim(`\nSkipped ${existing.length} existing file(s) (use --force to overwrite):`));
    for (const e of existing) console.log(`  ${chalk.dim(e)}`);
  }
  console.log();
  return 0;
}

async function main(): Promise<number> {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(HELP);
    return 0;
  }
  let cmd = flags._[0];
  if (!cmd) {
    if (!isInteractive()) {
      console.log(HELP);
      return 1;
    }
    const { picked } = await inquirer.prompt<{ picked: string }>([
      {
        type: 'list',
        name: 'picked',
        message: 'What do you want to do?',
        choices: [
          { name: 'Push  .env files  → GitHub secrets', value: 'push' },
          { name: 'Pull  secrets     → .env files', value: 'pull' },
        ],
      },
    ]);
    cmd = picked;
  }

  if (cmd === 'push') return runPush(flags);
  if (cmd === 'pull') return runPull(flags);
  console.error(chalk.red(`Unknown command: ${cmd}\n`));
  console.log(HELP);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(chalk.red(err?.message ?? String(err)));
    process.exit(1);
  });
