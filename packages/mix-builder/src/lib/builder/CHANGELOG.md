# Mix Builder - Changelog

## [2.0.0] - Enhanced Builder System

### 🎉 Major Features

#### Advanced CLI with Interactive Prompts
- **Interactive Mode**: Added full Inquirer.js integration for user-friendly configuration
- **Smart CLI Arguments**: Comprehensive CLI argument parsing with validation
- **Non-Interactive Mode**: CI/CD friendly mode with full CLI argument support
- **Configuration Merging**: Intelligent merging of CLI args, config files, and defaults

#### Unified Build Orchestration
- **Dual Builder Support**: Use Rollup, ESBuild, or both in a single build process
- **Build Orchestrator**: New orchestrator module to coordinate both builders
- **Build Statistics**: Detailed build reports with timing and output information
- **Progress Indicators**: Real-time progress tracking during builds

#### Enhanced Configuration System
- **JSON Schema Validation**: Comprehensive schema for build-config.json
- **Per-Entry Configuration**: Override global settings for individual entries
- **Glob Pattern Support**: Build multiple files with glob patterns
- **External Dependencies**: Smart handling of React, Lit, and library externals

### 📋 New Files & Modules

#### Core Modules
- `cli_prepare.ts` - Interactive CLI with Inquirer prompts
- `orchestrator.ts` - Build orchestration for Rollup and ESBuild
- `utils.ts` - Shared utilities, validation, and configuration loading
- `index.ts` - Unified exports for all builder modules

#### Configuration
- `schema/build-config.schema.json` - Enhanced JSON schema with 100+ properties
- `examples/build-config.example.json` - Comprehensive example configuration
- `examples/build-config.simple.json` - Simple starter configuration
- `examples/build-config.components.json` - Component library example

#### Documentation
- `README.md` - Complete documentation with API reference
- `QUICKSTART.md` - Quick start guide with common use cases
- `CHANGELOG.md` - This changelog

### 🔧 Enhanced Configuration Options

#### Root Level Configuration
```json
{
  "builder": "rollup" | "esbuild" | "both",
  "outdir": "dist",
  "subdir": "src",
  "formats": ["es", "cjs", "umd", "iife"],
  "extensions": [".ts", ".tsx", ".js", ".jsx"],
  "externals": ["react", "lodash"],
  "reactExternal": true,
  "litExternal": true,
  "libExternal": true,
  "nodeEnv": "development" | "production",
  "clean": true,
  "watch": true,
  "debug": false
}
```

#### ESBuild-Specific Options
- `bundle`, `splitting`, `minify` - Build optimization
- `minifySyntax`, `minifyWhitespace`, `minifyIdentifiers` - Granular minification
- `treeShaking` - Tree shaking control
- `platform` - Target platform (browser, node, neutral)
- `target` - JavaScript target version
- `jsx`, `jsxImportSource` - JSX configuration
- `outExtension` - Custom file extensions
- `entryNames`, `chunkNames`, `assetNames` - Output naming patterns

#### Rollup-Specific Options
- `exports` - Export mode (auto, default, named, none)
- `sourcemap` - Source map generation
- `treeshake` - Tree shaking
- `preserveModules` - Preserve module structure
- `plugins` - Plugin configurations (TypeScript, Babel)
- `copy` - File copy operations

### 🚀 New CLI Commands & Arguments

#### Builder Selection
```bash
--builder=rollup|esbuild|both
--use=rollup|esbuild|tsup  # Legacy support
```

#### Configuration
```bash
--buildConfigFile=build-config.json
--outdir=dist
--subdir=src
```

#### Formats & Extensions
```bash
--formats=es,cjs,umd
--extensions=.ts,.tsx,.js
--externals=react,lodash
```

#### External Dependencies
```bash
--reactExternal
--litExternal
--libExternal
--pkgExternal
--skipExternal
```

#### Build Options
```bash
--minify
--sourcemap
--bundle
--splitting
--treeShaking
--dts
```

#### Environment & Platform
```bash
--nodeEnv=development|production
--platform=browser|node|neutral
--target=es2021
```

#### Behavior
```bash
--log
--debug
--watch
--clean
--copy_pkg
```

### 📊 Build Statistics & Reporting

#### Per-Builder Statistics
- Total entries processed
- Successful builds
- Failed builds
- Success rate percentage
- Build duration
- Individual file timings

#### Overall Summary
- Combined statistics across all builders
- Total duration
- Formatted file sizes
- Progress indicators

### 🎯 Use Cases & Examples

#### Simple Library
```bash
npx mix-builder --builder=esbuild --formats=esm,cjs --minify
```

#### React Component Library
```json
{
  "builder": "esbuild",
  "reactExternal": true,
  "esbuild": {
    "entries": ["src/components/index.ts"],
    "formats": ["esm"],
    "jsx": "automatic"
  }
}
```

#### Universal Package (Both Builders)
```json
{
  "builder": "both",
  "rollup": {
    "entries": { "src/index.ts": { "formats": ["umd"] } }
  },
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}
```

### ✨ Interactive Mode Features

When running without configuration:
```bash
npx mix-builder
```

You'll be prompted for:
- Builder selection (Rollup, ESBuild, or both)
- Output formats
- Target platform
- Node environment
- Minification settings
- Source map generation
- Bundle options
- Code splitting
- Tree shaking
- TypeScript declarations
- External dependencies (React, Lit, library packages)
- Package.json copying
- Watch mode
- Clean builds
- Debug mode

### 🔍 Validation & Error Handling

#### Configuration Validation
- Builder type validation
- Format validation (es, esm, cjs, umd, iife)
- Platform validation (browser, node, neutral)
- Environment validation (development, production)
- Entry point validation

#### Helpful Error Messages
```bash
❌ Configuration validation failed:
  • Invalid builder: foo. Must be 'rollup', 'esbuild', or 'both'
  • Invalid formats: amd. Valid formats: es, esm, cjs, umd, iife
  • Rollup configuration requires entries
```

### 🎨 Enhanced Output

#### Color-Coded Console
- Cyan for headers and sections
- Green for success messages
- Red for errors
- Yellow for warnings
- Gray for metadata

#### Progress Tracking
```
🔨 Starting ESBuild...

  ✓ Built index.ts [esm] in 234ms
  ✓ Built utils.ts [esm] in 156ms

📊 ESBUILD Build Statistics:
  Total Entries: 2
  Successful: 2
  Failed: 0
  Success Rate: 100%
  Duration: 390ms
```

### 🔄 Configuration Priority

Configurations are merged in this order (highest to lowest priority):
1. CLI Arguments
2. Interactive Prompts
3. Configuration File
4. Default Values

### 🧪 CI/CD Integration

#### GitHub Actions
```yaml
- name: Build
  run: npx mix-builder --builder=both --minify
  env:
    CI: true
```

#### Non-Interactive Mode
```bash
CI=true npx mix-builder
```

### 📦 Dependencies

#### Required
- `inquirer` - Interactive CLI prompts (auto-installed)
- `chalk` - Colored console output
- `esbuild` - ESBuild bundler
- `rollup` - Rollup bundler
- `fast-glob` - Glob pattern matching

#### Development
- TypeScript type definitions
- JSON schema validation

### 🔧 Breaking Changes

#### From v1.x to v2.0
- CLI interface completely redesigned
- Configuration file format enhanced (backward compatible)
- New default behavior with interactive mode
- `--use` parameter deprecated in favor of `--builder`

#### Migration Guide

**Old (v1.x):**
```bash
node cli.js
```

**New (v2.0):**
```bash
npx mix-builder
# or
npx mix-builder --builder=esbuild
```

**Old Config:**
```json
{
  "esbuild": {
    "entries": ["src/index.ts"]
  }
}
```

**New Config (enhanced but backward compatible):**
```json
{
  "builder": "esbuild",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm"]
  }
}
```

### 🐛 Bug Fixes

- Fixed entry resolution for glob patterns
- Fixed external dependency handling
- Fixed format resolution for legacy formats
- Fixed output directory creation
- Fixed package.json copying

### 🎯 Performance Improvements

- Parallel build processing (where applicable)
- Smart caching for configuration loading
- Optimized glob pattern matching
- Reduced redundant file operations

### 📝 Documentation

- Comprehensive README with 600+ lines
- Quick start guide with common use cases
- Multiple example configurations
- API reference for programmatic usage
- Troubleshooting guide
- Best practices section

### 🎓 Examples Provided

1. **Simple Library** - Basic ESBuild setup
2. **React Component Library** - Components with external React
3. **Multi-Entry Library** - Multiple entry points with different configs
4. **Universal Package** - Both Rollup and ESBuild
5. **Node.js CLI Tool** - Command-line tool configuration
6. **Component Library** - Full-featured component library setup

### 🔮 Future Enhancements (Roadmap)

- [ ] Watch mode implementation
- [ ] Plugin system for custom transformations
- [ ] Build cache for faster incremental builds
- [ ] Parallel build execution
- [ ] Build profiles (dev, prod, test)
- [ ] TypeScript declaration bundling
- [ ] Asset optimization
- [ ] Bundle analysis and reports
- [ ] Hot module replacement (HMR)
- [ ] Custom output templates

### 🙏 Acknowledgments

This enhancement was built to provide a unified, user-friendly build experience that combines the best of both Rollup and ESBuild while maintaining flexibility and developer productivity.

### 📞 Support

For issues, questions, or contributions:
- Check the README.md for detailed documentation
- Review QUICKSTART.md for common use cases
- Examine example configurations in /examples
- Enable debug mode with `--debug` for troubleshooting

---

## [1.0.0] - Initial Release

### Features
- Basic ESBuild integration
- Configuration file support
- Entry point processing
- Format resolution
- External dependency handling

---

**Legend:**
- 🎉 Major Features
- ✨ New Features
- 🔧 Enhancements
- 🐛 Bug Fixes
- 📝 Documentation
- 🔄 Changes
- ⚠️ Deprecations
- 💥 Breaking Changes