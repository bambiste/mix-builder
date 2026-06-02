# Mix Builder - Quick Reference Card

## 🚀 Installation

```bash
pnpm add -D @your-scope/mix-builder
```

## 📝 Basic Usage

### Interactive Mode
```bash
npx mix-builder
```

### CLI Mode
```bash
npx mix-builder --builder=esbuild --formats=esm,cjs --minify
```

### Config File
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}
```

## 🎯 Common Commands

### Development
```bash
npx mix-builder --nodeEnv=development --sourcemap --minify=false
```

### Production
```bash
npx mix-builder --nodeEnv=production --minify --clean --dts
```

### React Library
```bash
npx mix-builder --builder=esbuild --reactExternal --formats=esm
```

### Node CLI
```bash
npx mix-builder --builder=esbuild --platform=node --formats=cjs --pkgExternal
```

### Universal Package
```bash
npx mix-builder --builder=both --formats=esm,cjs,umd
```

## 📋 CLI Arguments

### Builder Selection
| Argument | Values | Default |
|----------|--------|---------|
| `--builder` | rollup, esbuild, both | both |
| `--use` | rollup, esbuild | esbuild |

### Formats & Output
| Argument | Values | Default |
|----------|--------|---------|
| `--formats` | es,esm,cjs,umd,iife | es |
| `--outdir` | string | dist |
| `--clean` | boolean | false |

### Externals
| Argument | Description |
|----------|-------------|
| `--externals` | Comma-separated packages |
| `--reactExternal` | React + react-dom + sub-paths |
| `--litExternal` | Lit + lit-html + @lit/* |
| `--libExternal` | @fluixi/* + @adafri/* |
| `--pkgExternal` | package.json deps |
| `--nodeExternal` | Node.js built-ins |
| `--skipExternal` | Bundle everything |

### Build Options
| Argument | Default | Description |
|----------|---------|-------------|
| `--minify` | true | Minify output |
| `--sourcemap` | false | Generate source maps |
| `--bundle` | true | Bundle dependencies |
| `--splitting` | true | Code splitting (ESM) |
| `--treeShaking` | true | Tree shaking |
| `--dts` | false | TypeScript declarations |

### Environment
| Argument | Values | Default |
|----------|--------|---------|
| `--nodeEnv` | development, production | production |
| `--platform` | browser, node, neutral | browser |
| `--target` | es2020, node16, etc. | es2021 |

### Behavior
| Argument | Default | Description |
|----------|---------|-------------|
| `--log` | true | Enable logging |
| `--debug` | false | Debug mode |
| `--watch` | false | Watch mode (coming) |
| `--copy_pkg` | false | Copy package.json |

## 📦 External Patterns

### String Pattern
```json
{
  "externals": ["react", "lodash"]
}
```

### Regex Pattern (JSON)
```json
{
  "externals": ["^react($|/)", "^@company/"]
}
```

### Config Object
```json
{
  "externals": [
    {
      "pattern": "axios",
      "includeSub": true
    }
  ]
}
```

### Presets
```json
{
  "reactExternal": true,
  "litExternal": true,
  "pkgExternal": true
}
```

## 🎨 Configuration Examples

### Simple Library
```json
{
  "builder": "esbuild",
  "outdir": "dist",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"],
    "minify": true
  }
}
```

### React Components
```json
{
  "builder": "esbuild",
  "reactExternal": true,
  "esbuild": {
    "entries": ["src/components/index.ts"],
    "formats": ["esm"],
    "platform": "browser",
    "jsx": "automatic"
  }
}
```

### Node CLI Tool
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/cli.ts"],
    "formats": ["cjs"],
    "platform": "node",
    "pkgExternal": true
  }
}
```

### Universal Package
```json
{
  "builder": "both",
  "rollup": {
    "entries": {
      "src/index.ts": {
        "formats": ["umd"],
        "name": "MyLib",
        "globals": { "react": "React" }
      }
    }
  },
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}
```

### Multi-Entry
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": {
      "src/index.ts": { "formats": ["esm", "cjs"] },
      "src/cli.ts": { "formats": ["cjs"], "platform": "node" }
    }
  }
}
```

## 🛠️ package.json Scripts

```json
{
  "scripts": {
    "build": "mix-builder",
    "build:dev": "mix-builder --nodeEnv=development --sourcemap",
    "build:prod": "mix-builder --nodeEnv=production --minify --clean",
    "build:watch": "mix-builder --watch",
    "prebuild": "mix-builder --clean"
  }
}
```

## 🔍 Debugging

### Enable Debug Mode
```bash
npx mix-builder --debug --log
```

### Check Configuration
```bash
npx mix-builder --dryRun
```

### CI Mode
```bash
CI=true npx mix-builder
```

## 📊 Output Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| `es/esm` | .mjs | Modern bundlers |
| `cjs` | .cjs | Node.js require() |
| `umd` | .umd.js | Browser globals |
| `iife` | .iife.js | Browser script tag |

## 🎯 Common Scenarios

### Library for npm
```bash
npx mix-builder \
  --builder=esbuild \
  --formats=esm,cjs \
  --pkgExternal \
  --dts
```

### React Component Library
```bash
npx mix-builder \
  --builder=esbuild \
  --formats=esm \
  --reactExternal \
  --splitting \
  --minify
```

### Node.js Package
```bash
npx mix-builder \
  --builder=esbuild \
  --formats=cjs \
  --platform=node \
  --pkgExternal \
  --nodeExternal
```

### Browser Library (UMD)
```bash
npx mix-builder \
  --builder=rollup \
  --formats=umd \
  --minify
```

## 📚 Quick Links

- **Docs:** `/docs/docs/mix-builder/`
- **Externals Guide:** `/docs/docs/mix-builder/externals.md`
- **CLI Reference:** `/docs/docs/mix-builder/cli-reference.md`
- **Quick Start:** `/docs/docs/mix-builder/quick-start.md`

## 🐛 Troubleshooting

### Problem: No entries found
**Solution:** Check entry paths in config
```json
{ "entries": ["src/index.ts"] }
```

### Problem: Module not found: react
**Solution:** Mark as external
```bash
npx mix-builder --reactExternal
```

### Problem: Large bundle
**Solution:** Enable externals
```bash
npx mix-builder --pkgExternal --treeShaking
```

### Problem: Build fails in CI
**Solution:** Set CI mode
```bash
CI=true npx mix-builder
```

## 💡 Pro Tips

1. **Use presets** - `--reactExternal` instead of listing packages
2. **Enable source maps in dev** - `--sourcemap --nodeEnv=development`
3. **Clean before production** - `--clean --minify`
4. **Test with debug** - `--debug --log`
5. **Version control config** - Commit `build-config.json`

## 🎉 Quick Start (30 seconds)

```bash
# 1. Install
pnpm add -D @your-scope/mix-builder

# 2. Create config
echo '{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}' > build-config.json

# 3. Build!
npx mix-builder
```

---

**Version:** 2.0.0  
**Docs:** `/docs/docs/mix-builder/`  
**Support:** GitHub Issues

🚀 **Happy Building!**
