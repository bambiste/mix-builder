---
"@bambiste/mix-builder": minor
---

The builder now supports a `banner` option that prepends a copyright and authorship comment to built files, substituting tokens like `{name}`, `{version}`, `{year}` from the package's package.json.

`include` and `exclude` globs pick which entries get it, so the file a consumer loads can be marked while internal chunks stay bare.
