# mix-builder

Build and release tools for TypeScript monorepos, published to npm under the `@bambiste` scope.

## Packages

| Package | CLI | Description |
|---|---|---|
| [`@bambiste/mix-builder`](./packages/mix-builder) | `mix-builder`, `mix-publisher` | A fast esbuild + Rollup library bundler: multi-format output (esm/cjs/iife), CDN globals, and per-file raw + gzip size reporting. |
| [`@bambiste/mix-env`](./packages/mix-env) | `mix-env` | Sync .env files to/from GitHub Actions secrets across a monorepo: push local env files up as secrets, and materialize them back into files (locally, in CI, or on a VPS). |

Each package has its own README with install and usage.

## Development

```bash
pnpm install
pnpm build
```

## Releasing

Releases use [Changesets](https://github.com/changesets/changesets). `main` publishes to the `latest` tag.

```bash
pnpm changeset   # record what changed
git push         # CI opens a "Version packages" PR; merging it publishes
```

## License

MIT
