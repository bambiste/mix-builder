<p align="center">
  <img src="https://raw.githubusercontent.com/fluixi/assets/main/logos/128x128.png" alt="mix" width="120" height="120" />
</p>

# @bambiste/mix-env

**Sync `.env` files to and from GitHub Actions secrets across a monorepo: push local env files up as secrets, and materialize them back into files locally, in CI, or on a VPS.**

![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![npm](https://img.shields.io/badge/registry-npm-cb3837?logo=npm)

---

`mix-env` solves a common monorepo problem: each app has a `.env.prod` (or `.env.dev`, ...) full of secrets that must **not** be committed, but still need to reach CI and the server. It scans the workspace for matching env files, stores each one as a GitHub Actions secret, and can recreate them anywhere the secrets are available as environment variables.

## How it works

- Each env file becomes **one** secret named `<PACKAGE>_ENV_<TYPE>` holding the **base64** of the file:
  - `packages/backend/.env.prod` → `BACKEND_ENV_PROD`
  - `packages/storefront/.env.prod` → `STOREFRONT_ENV_PROD`
- **push** (local, uses `gh`): find files → upload as secrets.
- **pull** (CI / VPS): read those secrets from the environment → write the files back (mode `600`).

> GitHub secrets are write-only: you can't read their values back via the API. So `pull` reads from `process.env`, which CI populates from the secrets (and which you forward to a VPS over SSH).

## Install

```bash
pnpm add -D @bambiste/mix-env
# or run ad-hoc:
npx @bambiste/mix-env --help
```

## Push (local → GitHub secrets)

```bash
mix-env push                      # interactive: pick environment, confirm
mix-env push --type production    # packages/*/.env.prod  -> *_ENV_PROD secrets
mix-env push --type development   # packages/*/.env.dev   -> *_ENV_DEV secrets
mix-env push --file .env.staging  # any custom file name
mix-env push -t production -y --repo owner/name   # non-interactive
```

## Pull (secrets/env → files)

Runs wherever the secret env vars are present:

```bash
mix-env pull --type production    # writes packages/*/.env.prod from *_ENV_PROD vars
```

### In a GitHub workflow
```yaml
- run: npx @bambiste/mix-env pull --type production
  env:
    BACKEND_ENV_PROD: ${{ secrets.BACKEND_ENV_PROD }}
    STOREFRONT_ENV_PROD: ${{ secrets.STOREFRONT_ENV_PROD }}
    # ...one line per app secret
```

### On a VPS (over SSH)
Forward the secrets to the box, then materialize:
```bash
npx @bambiste/mix-env pull --type production
```

## Programmatic API

```ts
import { findEnvFiles, pushEnvFiles, pullEnvFiles, detectRepo } from '@bambiste/mix-env';
```

## License

MIT
