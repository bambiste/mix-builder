# Mix Builder - Advanced Build System

A build system that integrates both Rollup and ESBuild in a single unified process, with support for interactive CLI prompts, configuration files, and comprehensive build orchestration.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [CLI Usage](#cli-usage)
- [API Usage](#api-usage)
- [Examples](#examples)
- [Advanced Features](#advanced-features)

## Features

- **Dual Builder Support**: Use Rollup, ESBuild, or both in the same build process
- **Interactive CLI**: User-friendly prompts with Inquirer.js for configuration
- **Configuration Files**: JSON schema-validated configuration files
- **CLI Arguments**: Full support for command-line argument overrides
- **Smart Validation**: Configuration validation with helpful error messages
- **Build Statistics**: Detailed build reports with timing and output information
- **Tree Shaking**: Intelligent tree-shaking support for both builders
- **Multi-Format Output**: Support for ES, CJS, UMD, and IIFE formats
- **Pretty Output**: Color-coded console output with progress indicators
- **Watch Mode**: File watching for development (coming soon)
- **Clean Builds**: Automatic output directory cleaning

## Installation

```bash
# Using pnpm
pnpm add -D @your-scope/mix-builder

# Using npm
npm install -D @your-scope/mix-builder

# Using yarn
yarn add -D @your-scope/mix-builder
```

## Quick Start

### 1. Create a Configuration File

Create a `build-config.json` in your project root:

```json
{
  "rollup": {
    "entries": ["src/index.ts"],
    "formats": ["es", "cjs"],
    "extensions": [".ts", ".tsx", ".js", ".jsx"],
    "externals": ["react", "react-dom"]
  },
  "esbuild": {
    "entries": ["src/components/index.ts"],
    "formats": ["esm"],
    "platform": "browser",
    "minify": true
  }
}
```

### 2. Run the Builder

```bash
# Interactive mode (with prompts)
npx mix-builder

# Non-interactive mode (using config file)
npx mix-builder --builder=both

# CLI-only mode
npx mix-builder --builder=esbuild --formats=es,cjs --minify
```

### 3. Add to package.json Scripts

```json
{
  "scripts": {
    "build": "mix-builder",
    "build:esbuild": "mix-builder --builder=esbuild",
    "build:rollup": "mix-builder --builder=rollup",
    "build:prod": "mix-builder --nodeEnv=production --minify",
    "build:dev": "mix-builder --nodeEnv=development --sourcemap"
  }
}
```

## Configuration

### Configuration File Schema

The builder uses a JSON schema for configuration validation.

#### Root Configuration

```json
{
  "builder": "both",           // "rollup" | "esbuild" | "both"
  "outdir": "dist",            // Output directory
  "subdir": "src",             // Subdirectory to maintain structure
  "formats": ["es", "cjs"],    // Global output formats
  "extensions": [".ts", ".tsx"], // File extensions to resolve
  "externals": ["react"],      // Global external dependencies
  "reactExternal": true,       // Treat React as external
  "litExternal": false,        // Treat Lit as external
  "libExternal": false,        // Treat @fluixi/* as external
  "nodeEnv": "production",     // "development" | "production"
  "log": true,                 // Enable build logging
  "debug": false,              // Enable debug mode
  "clean": true,               // Clean output before build
  "rollup": { /* ... */ },     // Rollup-specific config
  "esbuild": { /* ... */ }     // ESBuild-specific config
}
```

#### Rollup Configuration

```json
{
  "rollup": {
    "entries": {
      "src/index.ts": {
        "name": "MyLibrary",
        "formats": ["es", "cjs"],
        "buildType": "bundled",
        "externals": ["lodash"]
      },
      "src/utils.ts": {
        "formats": ["es"]
      }
    },
    "exports": "named",
    "sourcemap": true,
    "minify": false,
    "treeshake": true,
    "preserveModules": false,
    "plugins": {
      "typescript": {
        "enabled": true
      },
      "babel": {
        "enabled": true
      }
    },
    "copy": [
      {
        "src": "README.md",
        "dest": "dist/README.md"
      }
    ]
  }
}
```

#### ESBuild Configuration

```json
{
  "esbuild": {
    "entries": ["src/index.ts", "src/components/*.tsx"],
    "formats": ["esm"],
    "bundle": true,
    "splitting": true,
    "minify": true,
    "minifySyntax": true,
    "minifyWhitespace": true,
    "minifyIdentifiers": true,
    "sourcemap": false,
    "treeShaking": true,
    "platform": "browser",
    "target": "es2021",
    "outExtension": {
      ".js": ".mjs"
    },
    "entryNames": "[name]",
    "chunkNames": "[name]-[hash]",
    "assetNames": "[name]-[hash]",
    "jsx": "automatic",
    "jsxImportSource": "react",
    "noExternal": false,
    "pkgExternals": false
  }
}
```

#### Entry Configuration

Entries can be defined as:

1. **Array of strings**:
```json
"entries": ["src/index.ts", "src/utils.ts"]
```

2. **Object with configurations**:
```json
"entries": {
  "src/index.ts": {
    "name": "MyLib",
    "formats": ["es", "cjs"],
    "buildType": "bundled",
    "externals": ["react"]
  }
}
```

3. **Glob patterns** (for multiple files):
```json
"entries": ["src/components/*.tsx"]
```

#### Build Types

- **`bundled`**: Bundle all dependencies (default)
- **`external`**: All dependencies marked as external
- **`inline`**: Inline small dependencies
- **`runtime`**: Use Babel runtime helpers (Rollup only)

## CLI Usage

### Available CLI Arguments

```bash
# Builder Selection
--builder=rollup|esbuild|both    # Choose which builder(s) to use
--use=rollup|esbuild|tsup        # Legacy builder selection

# Input/Output
--buildConfigFile=build-config.json  # Config file path
--outdir=dist                        # Output directory
--subdir=src                         # Subdirectory to maintain

# Formats and Extensions
--formats=es,cjs,umd                # Output formats (comma-separated)
--extensions=.ts,.tsx,.js           # File extensions (comma-separated)
--externals=react,lodash            # External packages (comma-separated)

# External Dependencies
--reactExternal                     # Mark React as external
--litExternal                       # Mark Lit as external
--libExternal                       # Mark @fluixi/* as external
--pkgExternal                       # Mark package.json deps as external
--skipExternal                      # Skip external processing

# Build Options
--minify                            # Minify output
--sourcemap                         # Generate source maps
--bundle                            # Bundle dependencies
--splitting                         # Enable code splitting (ESM)
--treeShaking                       # Enable tree shaking
--dts                               # Generate TypeScript declarations

# Environment
--nodeEnv=development|production    # Node environment
--platform=browser|node|neutral     # Target platform
--target=es2021                     # JavaScript target

# Behavior
--log                               # Enable logging
--debug                             # Enable debug mode
--watch                             # Enable watch mode
--clean                             # Clean output before build
--copy_pkg                          # Copy package.json to output
```

### Interactive Mode

When run without arguments or config file, the builder enters interactive mode:

```bash
npx mix-builder
```

You'll be prompted for:
- Which builder(s) to use
- Output formats
- Target platform
- Environment settings
- Minification options
- External dependencies
- And more...

### Non-Interactive Mode

For CI/CD pipelines or scripted builds:

```bash
# Using config file in CI
CI=true npx mix-builder

# Using CLI arguments only
npx mix-builder --builder=esbuild --formats=es --minify --nodeEnv=production
```

### Examples

```bash
# Build with ESBuild only, production mode
npx mix-builder --builder=esbuild --nodeEnv=production --minify

# Build with both builders, development mode with source maps
npx mix-builder --builder=both --nodeEnv=development --sourcemap

# Build with Rollup, multiple formats
npx mix-builder --builder=rollup --formats=es,cjs,umd

# Build with external React and Lit
npx mix-builder --reactExternal --litExternal

# Build with custom output directory
npx mix-builder --outdir=build --clean

# Debug mode with detailed logging
npx mix-builder --debug --log
```

## API Usage

### Programmatic Usage

```typescript
import { buildWithMixBuilder, BuilderConfig } from '@your-scope/mix-builder';

const config: BuilderConfig = {
  builder: 'both',
  outdir: 'dist',
  formats: ['es', 'cjs'],
  minify: true,
  rollup: {
    entries: ['src/index.ts'],
    formats: ['es', 'cjs']
  },
  esbuild: {
    entries: ['src/components/index.ts'],
    formats: ['esm'],
    platform: 'browser'
  }
};

await buildWithMixBuilder(config);
```

### Using Individual Builders

```typescript
import { buildWithEsBuild } from '@your-scope/mix-builder';

// ESBuild only
buildWithEsBuild();
```

### Custom Configuration Loading

```typescript
import { loadConfigFile, validateConfig, buildWithMixBuilder } from '@your-scope/mix-builder';

// Load config from custom location
const config = loadConfigFile('custom-build.json', './configs');

// Validate before building
const validation = validateConfig(config);
if (!validation.valid) {
  console.error('Invalid configuration:', validation.errors);
  process.exit(1);
}

// Build with validated config
await buildWithMixBuilder(config);
```

## Examples

### Example 1: Library with Multiple Entry Points

```json
{
  "builder": "both",
  "outdir": "dist",
  "formats": ["es", "cjs"],
  "reactExternal": true,
  "rollup": {
    "entries": {
      "src/index.ts": {
        "name": "MyLib",
        "formats": ["es", "cjs", "umd"]
      },
      "src/utils/index.ts": {
        "formats": ["es", "cjs"]
      }
    }
  },
  "esbuild": {
    "entries": ["src/components/index.ts"],
    "formats": ["esm"],
    "platform": "browser",
    "minify": true
  }
}
```

### Example 2: Component Library

```json
{
  "builder": "esbuild",
  "outdir": "dist",
  "clean": true,
  "esbuild": {
    "entries": ["src/components/*.tsx"],
    "formats": ["esm"],
    "platform": "browser",
    "target": "es2020",
    "minify": true,
    "splitting": true,
    "treeShaking": true,
    "jsx": "automatic",
    "jsxImportSource": "react",
    "reactExternal": true,
    "dts": true,
    "copy_pkg": true
  }
}
```

### Example 3: Node.js CLI Tool

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

### Example 4: Universal Package (Browser + Node)

```json
{
  "builder": "rollup",
  "outdir": "dist",
  "rollup": {
    "entries": {
      "src/index.ts": {
        "formats": ["es", "cjs", "umd"],
        "name": "UniversalLib"
      }
    },
    "exports": "named",
    "treeshake": true,
    "minify": false,
    "copy": [
      { "src": "package.json", "dest": "dist/package.json" },
      { "src": "README.md", "dest": "dist/README.md" }
    ]
  }
}
```

## Advanced Features

### Glob Pattern Support

Build multiple files with glob patterns:

```json
{
  "esbuild": {
    "entries": [
      "src/components/**/*.tsx",
      "src/utils/**/*.ts"
    ]
  }
}
```

### Per-Entry Configuration

Override global settings per entry:

```json
{
  "esbuild": {
    "formats": ["esm"],
    "minify": true,
    "entries": {
      "src/index.ts": {
        "formats": ["esm", "cjs"],
        "minify": false
      },
      "src/worker.ts": {
        "platform": "node",
        "target": "node16"
      }
    }
  }
}
```

### Build Statistics

The builder provides detailed statistics after each build:

```
📊 ESBUILD Build Statistics:
  Total Entries: 15
  Successful: 15
  Failed: 0
  Success Rate: 100%
  Duration: 2.34s

  Output Files:
    - index.ts [esm] (45.23 KB) - 234ms
    - utils.ts [esm] (12.45 KB) - 156ms
    ...

📈 Overall Build Summary:
  Total Entries: 25
  Successful: 25
  Failed: 0
  Total Duration: 4.56s
```

### Error Handling

Error handling with helpful messages:

```bash
❌ Configuration validation failed:
  - Invalid builder: foo. Must be 'rollup', 'esbuild', or 'both'
  - Invalid formats: amd. Valid formats: es, esm, cjs, umd, iife
  - Rollup configuration requires entries
```

### CI/CD Integration

Perfect for continuous integration:

```yaml
# GitHub Actions
- name: Build packages
  run: npx mix-builder --builder=both --minify --nodeEnv=production
  env:
    CI: true
```

### Configuration Merging

The builder merges configurations in this order (highest priority first):
1. CLI arguments
2. Interactive prompts (if applicable)
3. Configuration file
4. Default values

This allows for flexible configuration strategies:

```bash
# Override config file settings with CLI
npx mix-builder --minify=false --debug
```

## Best Practices

1. **Use Configuration Files**: Keep your build configuration in `build-config.json` for consistency
2. **Version Control**: Commit your `build-config.json` to version control
3. **Separate Concerns**: Use Rollup for libraries, ESBuild for applications
4. **External Dependencies**: Mark peer dependencies as external
5. **Source Maps**: Enable in development, disable in production
6. **Tree Shaking**: Always enable for smaller bundles
7. **Type Declarations**: Generate `.d.ts` files for TypeScript libraries

## Troubleshooting

### Common Issues

**Issue**: "No entries found"
- **Solution**: Check your `entries` configuration and ensure files exist

**Issue**: "Configuration validation failed"
- **Solution**: Review error messages and check your config against the schema

**Issue**: "Build failed with errors"
- **Solution**: Enable debug mode with `--debug` for detailed error information

**Issue**: "Inquirer not found"
- **Solution**: The CLI will automatically install it, or run `pnpm add -D inquirer`

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Configuration schema is updated for new features
- Documentation is updated
- Examples are provided

## Support

For issues and questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [your-docs-site]
- Discord: [your-discord]