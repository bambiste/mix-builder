---
"@bambiste/mix-builder": patch
---

Stop reinstalling `inquirer` on every build/publish. The `mix-builder` and
`mix-publisher` CLIs checked for `./node_modules/inquirer` in the CONSUMER's cwd and ran
`pnpm add -D inquirer` when it wasn't there — which (under pnpm's nested layout) was
almost every run, reinstalling it and polluting the consumer's `package.json`. `inquirer`
is already a declared dependency of `@bambiste/mix-builder`, so it resolves from the
package's own install; the auto-install fallback is removed.
