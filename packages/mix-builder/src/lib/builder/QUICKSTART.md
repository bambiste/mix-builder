# Mix Builder - Quick Start Guide

Get started with Mix Builder in under 5 minutes!

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add -D @your-scope/mix-builder

# Using npm
npm install -D @your-scope/mix-builder

# Using yarn
yarn add -D @your-scope/mix-builder
```

## 🚀 Three Ways to Use Mix Builder

### 1. Interactive Mode (Easiest)

Just run the command and answer the prompts:

```bash
npx mix-builder
```

You'll be asked about:
- Which builder to use (Rollup, ESBuild, or both)
- Output formats
- Platform target
- Minification settings
- External dependencies
- And more...

### 2. Configuration File (Recommended)

Create a `build-config.json` in your project root:

```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"],
    "platform": "browser",
    "minify": true
  }
}
```

Then run:

```bash
npx mix-builder
```

### 3. CLI Arguments (CI/CD Friendly)

Pass all options as command-line arguments:

```bash
npx mix-builder --builder=esbuild --formats=esm,cjs --minify --reactExternal
```

## 📝 Common Use Cases

### Use Case 1: Simple Library

**Goal**: Build a simple TypeScript library with ES and CJS outputs.

**build-config.json**:
```json
{
  "builder": "esbuild",
  "outdir": "dist",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"],
    "platform": "neutral",
    "minify": true,
    "sourcemap": true
  }
}
```

**package.json**:
```json
{
  "scripts": {
    "build": "mix-builder"
  }
}
```

**Run**:
```bash
npm run build
```

---

### Use Case 2: React Component Library

**Goal**: Build React components with external React dependency.

**build-config.json**:
```json
{
  "builder": "esbuild",
  "outdir": "dist",
  "reactExternal": true,
  "esbuild": {
    "entries": ["src/components/index.ts"],
    "formats": ["esm"],
    "platform": "browser",
    "target": "es2020",
    "minify": true,
    "splitting": true,
    "jsx": "automatic",
    "jsxImportSource": "react"
  }
}
```

**package.json**:
```json
{
  "scripts": {
    "build": "mix-builder",
    "build:watch": "mix-builder --watch"
  }
}
```

---

### Use Case 3: Multi-Entry Library

**Goal**: Build multiple entry points with different configurations.

**build-config.json**:
```json
{
  "builder": "esbuild",
  "outdir": "dist",
  "esbuild": {
    "entries": {
      "src/index.ts": {
        "formats": ["esm", "cjs"]
      },
      "src/utils/index.ts": {
        "formats": ["esm"]
      },
      "src/cli.ts": {
        "formats": ["cjs"],
        "platform": "node"
      }
    },
    "minify": true
  }
}
```

---

### Use Case 4: Universal Package (Rollup + ESBuild)

**Goal**: Use Rollup for UMD bundle and ESBuild for modern ESM.

**build-config.json**:
```json
{
  "builder": "both",
  "outdir": "dist",
  "rollup": {
    "entries": {
      "src/index.ts": {
        "name": "MyLib",
        "formats": ["umd"],
        "globals": {
          "react": "React"
        }
      }
    },
    "reactExternal": true
  },
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"],
    "platform": "browser",
    "minify": true,
    "reactExternal": true
  }
}
```

---

### Use Case 5: Node.js CLI Tool

**Goal**: Build a Node.js command-line tool.

**build-config.json**:
```json
{
  "builder": "esbuild",
  "outdir": "bin",
  "esbuild": {
    "entries": ["src/cli.ts"],
    "formats": ["cjs"],
    "platform": "node",
    "target": "node16",
    "bundle": true,
    "minify": false,
    "pkgExternals": true
  }
}
```

**package.json**:
```json
{
  "bin": {
    "my-cli": "./bin/cli.cjs"
  },
  "scripts": {
    "build": "mix-builder"
  }
}
```

---

### Use Case 6: Development vs Production

**Goal**: Different builds for dev and prod environments.

**package.json**:
```json
{
  "scripts": {
    "build": "mix-builder --nodeEnv=production --minify --clean",
    "build:dev": "mix-builder --nodeEnv=development --sourcemap",
    "watch": "mix-builder --watch --nodeEnv=development"
  }
}
```

Or use multiple config files:

**build-config.json** (production):
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm"],
    "minify": true,
    "sourcemap": false
  }
}
```

**build-config.dev.json** (development):
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm"],
    "minify": false,
    "sourcemap": true
  }
}
```

Then:
```bash
# Production
npx mix-builder

# Development
npx mix-builder --buildConfigFile=build-config.dev.json
```

---

## 🎯 Common CLI Commands

```bash
# Build with ESBuild only
npx mix-builder --builder=esbuild

# Build with Rollup only
npx mix-builder --builder=rollup

# Build with both builders
npx mix-builder --builder=both

# Production build
npx mix-builder --nodeEnv=production --minify --clean

# Development build with source maps
npx mix-builder --nodeEnv=development --sourcemap

# Build with external React
npx mix-builder --reactExternal

# Build with external Lit
npx mix-builder --litExternal

# Build multiple formats
npx mix-builder --formats=es,cjs,umd

# Custom output directory
npx mix-builder --outdir=build

# Clean before build
npx mix-builder --clean

# Debug mode
npx mix-builder --debug

# CI mode (non-interactive)
CI=true npx mix-builder
```

## 📋 Configuration Priority

Mix Builder merges configurations in this order (highest to lowest priority):

1. **CLI Arguments** - `--minify=false`
2. **Interactive Prompts** - Answers from inquirer
3. **Config File** - `build-config.json`
4. **Defaults** - Built-in defaults

Example:
```bash
# Even if config says minify: true, this will override it
npx mix-builder --minify=false
```

## 🔧 Essential Configuration Options

### Builder Selection
```json
{
  "builder": "rollup" | "esbuild" | "both"
}
```

### Entry Points
```json
{
  "esbuild": {
    "entries": [
      "src/index.ts",           // Single file
      "src/utils/*.ts",         // Glob pattern
      "src/components/**/*.tsx" // Recursive glob
    ]
  }
}
```

Or with per-entry config:
```json
{
  "esbuild": {
    "entries": {
      "src/index.ts": {
        "formats": ["esm", "cjs"],
        "minify": true
      },
      "src/worker.ts": {
        "formats": ["esm"],
        "platform": "node"
      }
    }
  }
}
```

### Output Formats
```json
{
  "formats": ["es", "esm", "cjs", "umd", "iife"]
}
```

### External Dependencies
```json
{
  "externals": ["react", "lodash"],
  "reactExternal": true,
  "litExternal": true,
  "pkgExternal": true
}
```

### Platform & Target
```json
{
  "esbuild": {
    "platform": "browser" | "node" | "neutral",
    "target": "es2020" | ["es2020", "chrome90", "node16"]
  }
}
```

## 📊 Understanding Build Output

After running, you'll see:

```
🏗️  Interactive Mix Builder Configuration

✓ Loaded configuration from build-config.json

📋 Build Configuration Summary:
  Builder: esbuild
  Output Directory: dist
  Formats: esm, cjs
  Platform: browser
  Target: es2021
  Minify: Yes
  Source Maps: No
  ...

🚀 Starting build process...

🔨 Starting ESBuild...

  ✓ Built index.ts [esm] in 234ms
  ✓ Built utils.ts [esm] in 156ms

📊 ESBUILD Build Statistics:
  Total Entries: 2
  Successful: 2
  Failed: 0
  Success Rate: 100%
  Duration: 390ms

📈 Overall Build Summary:
  Total Entries: 2
  Successful: 2
  Failed: 0
  Total Duration: 401ms

✅ Build completed successfully!
```

## 🐛 Troubleshooting

### Problem: "No entries found"
**Solution**: Check that your entry files exist and paths are correct.

```json
{
  "esbuild": {
    "entries": ["src/index.ts"] // ✓ Correct
    // "entries": ["index.ts"]  // ✗ Wrong if file is in src/
  }
}
```

### Problem: "Configuration validation failed"
**Solution**: Check the error message and fix the invalid configuration.

```bash
❌ Configuration validation failed:
  • Invalid builder: foo. Must be 'rollup', 'esbuild', or 'both'
```

### Problem: Build works locally but fails in CI
**Solution**: Ensure CI environment variable is set or provide all required CLI args.

```yaml
# GitHub Actions
- name: Build
  run: npx mix-builder
  env:
    CI: true
```

### Problem: "Module not found: react"
**Solution**: Mark React as external if it's a peer dependency.

```json
{
  "reactExternal": true
}
```

Or:

```bash
npx mix-builder --reactExternal
```

### Problem: Large bundle size
**Solution**: Enable tree shaking and mark dependencies as external.

```json
{
  "esbuild": {
    "treeShaking": true,
    "pkgExternals": true,
    "minify": true
  }
}
```

## 🎓 Next Steps

1. **Read the full README**: `./README.md`
2. **Check example configs**: `./examples/`
3. **Explore the schema**: `./schema/build-config.schema.json`
4. **Join the community**: [Your Discord/Forum link]

## 💡 Tips & Tricks

1. **Use glob patterns** for multiple files:
   ```json
   "entries": ["src/**/*.ts"]
   ```

2. **Per-entry configuration** for fine control:
   ```json
   "entries": {
     "src/index.ts": { "minify": true },
     "src/debug.ts": { "minify": false }
   }
   ```

3. **Copy package.json** to dist:
   ```json
   { "copy_pkg": true }
   ```

4. **Debug mode** for troubleshooting:
   ```bash
   npx mix-builder --debug
   ```

5. **Clean builds** for fresh start:
   ```bash
   npx mix-builder --clean
   ```

## 🎉 You're Ready!

Start building with:

```bash
npx mix-builder
```

Happy building! 🚀