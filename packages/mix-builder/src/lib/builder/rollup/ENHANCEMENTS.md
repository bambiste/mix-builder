# Rollup Builder - Enhancements Summary

## 🎯 Overview

The Rollup builder has been completely rewritten to match the ESBuild builder structure while maintaining all original functionality. It now includes advanced external dependency resolution, improved configuration handling, and better error reporting.

## 🔄 Major Changes

### 1. Complete Rewrite

**Before:**
- Procedural code with global state
- Mixed concerns and responsibilities
- Limited external handling
- No advanced pattern support

**After:**
- Modular, functional architecture
- Clear separation of concerns
- Advanced external resolver integration
- Multiple pattern types supported (string, regex, function, config objects)

### 2. Architecture Alignment

The new Rollup builder now follows the same pattern as ESBuild builder:

```typescript
// Consistent structure
function resolveConfig() { /* ... */ }
async function buildEntry() { /* ... */ }
async function _build() { /* ... */ }
export function buildWithRollup() { /* ... */ }
```

### 3. Advanced External Resolution

**New External Patterns:**

```typescript
// String patterns
"react"

// Regex patterns (JSON)
"^react($|/)"

// Configuration objects
{
  "pattern": "axios",
  "includeSub": true,
  "description": "HTTP client"
}
```

**Presets:**
- `--reactExternal` - React + react-dom + all sub-paths
- `--litExternal` - Lit + lit-html + lit-element + @lit/*
- `--libExternal` - @fluixi/* + @adafri/*
- `--nodeExternal` - Node.js built-ins
- `--pkgExternal` - package.json dependencies

### 4. Enhanced Configuration

**New Interface:**

```typescript
interface RollupBuilderConfig extends BaseBuilderConfig<any> {
  exports?: 'auto' | 'default' | 'named' | 'none';
  sourcemap?: boolean;
  minify?: boolean;
  treeshake?: boolean;
  preserveModules?: boolean;
  globals?: Record<string, string>;
  buildType?: 'bundled' | 'external' | 'inline' | 'runtime';
  babel?: {
    includes?: string[];
    exclude?: string[];
  };
  plugins?: {
    typescript?: { enabled?: boolean; config?: any };
    babel?: { enabled?: boolean; includes?: string[]; exclude?: string[] };
  };
  copy?: Array<{ src: string; dest: string }>;
}
```

### 5. Improved Plugin System

**Before:**
```javascript
// Hardcoded plugin configuration
plugins = [
  nodeResolve({ /* ... */ }),
  commonjs({ /* ... */ }),
  babel({ /* hardcoded config */ }),
];
```

**After:**
```typescript
// Dynamic plugin configuration based on options
const plugins: any[] = [];

plugins.push(nodeResolve({
  preferBuiltins: true,
  mainFields: ['main', 'module'],
  extensions,
  browser: format !== 'cjs',
  dedupe: ['lit', 'react', 'react-dom'],
}));

if (options.plugins?.typescript?.enabled !== false) {
  plugins.push(typescript({ /* config */ }));
}

if (babelEnabled) {
  plugins.push(babel({ /* dynamic config */ }));
}
```

## 📊 Feature Comparison

| Feature | Old | New |
|---------|-----|-----|
| External Patterns | Strings only | String, Regex, Function, Config Objects |
| External Presets | None | React, Lit, Node, Library, Package.json |
| Configuration | Global state | Per-entry + global |
| Error Handling | Basic | Advanced with debug mode |
| Plugin System | Hardcoded | Dynamic based on config |
| Output Structure | Fixed | Flexible with resolvers |
| Build Stats | None | Detailed reporting |
| Type Safety | Minimal | Full TypeScript types |

## 🔧 Configuration Examples

### Basic Build

```json
{
  "builder": "rollup",
  "rollup": {
    "entries": ["src/index.ts"],
    "formats": ["es", "cjs"],
    "sourcemap": true,
    "minify": false
  }
}
```

### Advanced Build with Externals

```json
{
  "builder": "rollup",
  "rollup": {
    "entries": {
      "src/index.ts": {
        "name": "MyLib",
        "formats": ["es", "cjs", "umd"],
        "externals": [
          "react",
          "^lodash/",
          {
            "pattern": "^@company/",
            "includeSub": true
          }
        ],
        "globals": {
          "react": "React"
        }
      }
    },
    "exports": "named",
    "sourcemap": true,
    "treeshake": true,
    "reactExternal": true,
    "pkgExternal": true
  }
}
```

### Runtime Build

```json
{
  "builder": "rollup",
  "rollup": {
    "entries": ["src/index.ts"],
    "formats": ["es"],
    "buildType": "runtime",
    "plugins": {
      "typescript": {
        "enabled": true
      },
      "babel": {
        "enabled": true,
        "includes": ["src/**/*.ts"]
      }
    }
  }
}
```

## 🎨 CLI Usage

```bash
# Basic Rollup build
npx mix-builder --builder=rollup

# With externals
npx mix-builder --builder=rollup --reactExternal --litExternal

# With specific formats
npx mix-builder --builder=rollup --formats=es,cjs,umd

# With minification
npx mix-builder --builder=rollup --minify --sourcemap

# With package.json externals
npx mix-builder --builder=rollup --pkgExternal
```

## 🔍 Key Functions

### `resolveConfig()`

Resolves complete Rollup configuration including:
- Input options (plugins, external, treeshake)
- Output options (format, sourcemap, exports)
- File extensions and naming
- Plugin configuration

### `buildEntry()`

Builds a single entry point:
1. Loads package.json
2. Resolves externals using advanced resolver
3. Configures Rollup plugins
4. Executes build
5. Writes output
6. Handles errors

### `_build()`

Builds all entries:
- Iterates through entry list
- Calls `buildEntry()` for each
- Collects results
- Reports statistics

### `buildWithRollup()`

Main export function:
- Initializes build configuration
- Parses CLI arguments
- Triggers build process

## 🐛 Bug Fixes

1. **Fixed Global State Issues**
   - Removed global `ROLLUP_CONFIG` variable
   - Configuration now passed through function parameters

2. **Fixed External Resolution**
   - Previously used hardcoded arrays
   - Now uses advanced resolver with multiple pattern types

3. **Fixed Output Directory Resolution**
   - Previously had path resolution issues
   - Now uses consistent resolver with ESBuild

4. **Fixed Plugin Configuration**
   - Previously hardcoded and inflexible
   - Now dynamic based on options

5. **Fixed Error Handling**
   - Previously minimal error messages
   - Now detailed with debug mode support

6. **Fixed Type Safety**
   - Previously loose typing
   - Now fully typed with TypeScript interfaces

## 📈 Performance Improvements

1. **Reduced Redundant Operations**
   - Configuration resolved once per entry
   - Externals resolved efficiently with advanced resolver

2. **Better Tree Shaking**
   - Configurable per build
   - Smart defaults based on format

3. **Optimized Plugin Loading**
   - Plugins only loaded when needed
   - Conditional TypeScript/Babel plugins

## 🎓 Migration Guide

### From Old to New

**Old Code:**
```javascript
// build-config.json
{
  "rollup": {
    "entries": ["src/index.ts"],
    "formats": ["es"]
  }
}
```

**New Code (Backward Compatible):**
```json
{
  "rollup": {
    "entries": ["src/index.ts"],
    "formats": ["es"],
    "sourcemap": true,
    "treeshake": true
  }
}
```

**With Advanced Features:**
```json
{
  "rollup": {
    "entries": {
      "src/index.ts": {
        "formats": ["es", "cjs"],
        "externals": [
          "react",
          "^lodash/"
        ]
      }
    },
    "reactExternal": true,
    "pkgExternal": true,
    "minify": false,
    "sourcemap": true
  }
}
```

## 🔗 Integration with ESBuild

Both builders now share:
- Common base configuration
- Advanced external resolver
- CLI argument parsing
- Progress tracking
- Error handling patterns

This allows seamless use of both builders in the same project:

```json
{
  "builder": "both",
  "rollup": {
    "entries": {
      "src/index.ts": { "formats": ["umd"] }
    }
  },
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}
```

## 🚀 Future Enhancements

- [ ] Watch mode support
- [ ] Incremental builds
- [ ] Build caching
- [ ] Parallel processing
- [ ] Plugin API
- [ ] Custom transformers
- [ ] Bundle analysis
- [ ] Performance profiling

## 📝 Documentation

Complete documentation available at:
- [Main Documentation](/docs/docs/mix-builder/index.md)
- [External Dependencies Guide](/docs/docs/mix-builder/externals.md)
- [CLI Reference](/docs/docs/mix-builder/cli-reference.md)
- [Quick Start](/docs/docs/mix-builder/quick-start.md)

## ✅ Testing Checklist

- [x] Basic build (ES format)
- [x] Multiple formats (ES, CJS, UMD)
- [x] External dependencies (string patterns)
- [x] External dependencies (regex patterns)
- [x] External presets (React, Lit)
- [x] Package.json externals
- [x] Runtime build type
- [x] TypeScript plugin
- [x] Babel plugin
- [x] Copy plugin
- [x] Minification
- [x] Source maps
- [x] UMD with globals
- [x] Error handling
- [x] Debug mode

## 📞 Support

For issues or questions:
- GitHub Issues: [Report bugs](https://github.com/your-org/mix-builder/issues)
- Documentation: [Full docs](/docs/docs/mix-builder/)
- Discord: [Community chat](https://discord.gg/your-invite)

---

**Version:** 2.0.0  
**Date:** 2024  
**Status:** ✅ Complete  
**Breaking Changes:** No (backward compatible)