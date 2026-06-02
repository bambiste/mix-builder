# NPM Package Publisher

Robust, type-safe package publisher for monorepo workspaces with version management, error recovery, and progress tracking.

## Features

- ✅ **Type-Safe Configuration** - Full TypeScript support with JSON schema validation
- 🔄 **Error Recovery** - Automatically saves progress and resumes from interruptions
- 📊 **Progress Tracking** - Real-time progress bars with time estimates
- 🔍 **Version Management** - Automatic semver versioning with history tracking
- 🏷️ **Tag Support** - Publish to different NPM tags (latest, beta, next, etc.)
- 🌐 **Custom Registry** - Support for private registries (GitHub, Google Artifact Registry, etc.)
- 🎯 **Selective Publishing** - Choose which packages to publish
- 🛡️ **Dependency Management** - Automatically updates workspace dependencies
- 🚀 **Batch Operations** - Global and per-package builds
- 🔒 **Dry Run Mode** - Test publishing without actually publishing

## Installation

```bash
npm install @fluixi/mix-builder
# or
pnpm add @fluixi/mix-builder
```

## Quick Start

### 1. Create Configuration File

Create `package-publish.json` in your project root:

```json
{
  "$schema": "./node_modules/@fluixi/mix-builder/schemas/publish-config.schema.json",
  "packages": [
    "@myorg/package-a",
    "@myorg/package-b",
    "@myorg/package-c"
  ],
  "excluded": ["internal", "examples"],
  "excluded_packages": ["@myorg/experimental"],
  "content": "**/packages/*/package.json",
  "packages_dir": "packages",
  "type": "patch",
  "tag": "latest",
  "access": "public"
}
```

### 2. Run Publisher

```typescript
import { publishPackages } from '@fluixi/mix-builder';

await publishPackages();
```

Or via command line:

```bash
node -e "import('@fluixi/mix-builder').then(m => m.publishPackages())"
```

## Configuration

### Configuration File

The publisher uses a JSON configuration file with the following structure:

```typescript
interface BuildConfig {
  packages: string[];              // Package names to publish
  excluded: string[];              // Directories to exclude
  excluded_packages: string[];     // Packages to exclude from build
  content: string;                 // Glob pattern for package.json files
  packages_dir?: string;           // Directory containing packages (default: 'packages')
  basePath?: string;               // Base path for resolving files
  type?: 'major' | 'minor' | 'patch'; // Version increment type (default: 'patch')
  tag?: string;                    // NPM tag (default: 'latest')
  version?: string;                // Base version to increment from
  suffix?: string;                 // Version suffix (e.g., 'beta', 'rc.1')
  registry?: string;               // Custom NPM registry URL
  access?: 'public' | 'restricted'; // Package access (default: 'restricted')
  global_build?: boolean;          // Run global build (default: true)
  package_build?: boolean;         // Build each package (default: true)
  skipBuild?: boolean;             // Skip all builds (default: false)
  dryRun?: boolean;                // Dry run mode (default: false)
  timeout?: number;                // Operation timeout in ms (default: 300000)
}
```

### Command Line Arguments

Override configuration file options via command line:

```bash
node publish.js --type=minor --tag=beta --suffix=beta.1 --dryRun=true
```

## Usage Examples

### Basic Publishing

```json
{
  "packages": ["@myorg/core", "@myorg/utils"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "type": "patch",
  "tag": "latest",
  "access": "public"
}
```

### Beta Release

```json
{
  "packages": ["@myorg/core", "@myorg/utils"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "type": "minor",
  "tag": "beta",
  "suffix": "beta.1",
  "access": "public"
}
```

### Private Registry (GitHub Packages)

```json
{
  "packages": ["@company/internal-lib"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "type": "patch",
  "tag": "latest",
  "access": "restricted",
  "registry": "https://npm.pkg.github.com"
}
```

### Google Artifact Registry

```json
{
  "packages": ["@myorg/package"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "registry": "https://us-central1-npm.pkg.dev/project-id/repo-name"
}
```

### Dry Run (Testing)

```json
{
  "packages": ["@myorg/core"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "dryRun": true
}
```

### Skip Build (Pre-built Packages)

```json
{
  "packages": ["@myorg/core"],
  "excluded": [],
  "excluded_packages": [],
  "content": "packages/*/package.json",
  "skipBuild": true
}
```

## Version Management

### Semver Increment Types

- **patch** (1.0.0 → 1.0.1) - Bug fixes and minor changes
- **minor** (1.0.0 → 1.1.0) - New features, backward compatible
- **major** (1.0.0 → 2.0.0) - Breaking changes

### Version Suffixes

Add pre-release identifiers:

```json
{
  "type": "minor",
  "suffix": "beta.1"
}
```

Results: `1.0.0 → 1.1.0-beta.1`

### Version History

The publisher maintains a history file (`.version-history.json`) tracking:

- All published versions
- Publication dates
- Tags used
- Version types

## NPM Tags

Publish to different distribution channels:

- **latest** - Default, stable releases
- **next** - Next version, testing
- **beta** - Beta releases
- **alpha** - Alpha releases
- **canary** - Nightly/unstable builds

Users can install specific tags:

```bash
npm install @myorg/package@beta
npm install @myorg/package@next
```

## Error Recovery

### Automatic State Saving

The publisher automatically saves progress to `.publish-state.json`:

```json
{
  "completedPackages": ["@myorg/package-a", "@myorg/package-b"],
  "currentVersion": "1.2.3",
  "startTime": 1234567890,
  "failedPackages": {}
}
```

### Resume Publishing

If interrupted (Ctrl+C, error, etc.), simply run again:

```bash
node publish.js
```

Output:
```
📦 Found interrupted publish state:
  Completed: 5 packages
  Version: 1.2.3

Resuming previous publish process...
```

### Graceful Interruption

- **First Ctrl+C**: Finishes current package, saves state
- **Second Ctrl+C**: Immediate exit, state saved

## Workflow

### Publishing Process

1. **Load Configuration** - Merge config file and CLI args
2. **Validate** - Check configuration and requirements
3. **Discover Packages** - Find all package.json files
4. **Version Calculation** - Determine new version
5. **Global Build** (optional) - Build entire workspace
6. **For Each Package:**
   - Update workspace dependencies
   - Build package (if enabled)
   - Update package.json version
   - Pack tarball
   - Publish to registry
   - Restore original package.json
   - Cleanup artifacts
7. **Save History** - Update version history
8. **Report Results** - Display summary

### Package Processing

For each package:

```
Processing @myorg/package-a...
├─ Updating dependencies ✓
├─ Building package ✓
├─ Packing tarball ✓
└─ Publishing to npm ✓
```

## Access Control

### Public Packages

```json
{
  "access": "public"
}
```

Required for:
- Unscoped packages (`package-name`)
- Public scoped packages (`@org/package`)

### Restricted Packages

```json
{
  "access": "restricted"
}
```

For:
- Private scoped packages (`@company/internal`)
- Packages requiring authentication

## Authentication

### NPM Registry

Set up authentication in `.npmrc`:

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

### GitHub Packages

```
@OWNER:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Google Artifact Registry

```
@SCOPE:registry=https://LOCATION-npm.pkg.dev/PROJECT/REPOSITORY/
//LOCATION-npm.pkg.dev/PROJECT/REPOSITORY/:_authToken=${TOKEN}
```

## Best Practices

### 1. Use Configuration Files

Store configuration in version control:

```json
// package-publish.json
{
  "packages": [...],
  // ... configuration
}
```

### 2. Test with Dry Run

Always test first:

```bash
node publish.js --dryRun=true
```

### 3. Use Semantic Versioning

Follow semver principles:
- **patch** for bug fixes
- **minor** for features
- **major** for breaking changes

### 4. Tag Pre-releases

Use tags and suffixes for pre-releases:

```json
{
  "tag": "beta",
  "suffix": "beta.1"
}
```

### 5. Exclude Development Packages

Don't publish internal tools:

```json
{
  "excluded_packages": [
    "@myorg/test-utils",
    "@myorg/internal-tools"
  ]
}
```

### 6. Set Appropriate Timeouts

For large packages, increase timeout:

```json
{
  "timeout": 600000
}
```

### 7. Use Private Registries

For internal packages:

```json
{
  "registry": "https://npm.pkg.github.com",
  "access": "restricted"
}
```

## Troubleshooting

### Configuration Errors

**Error:** `Invalid configuration: packages array is required`

**Solution:** Ensure `packages` array is defined and not empty.

### Permission Errors

**Error:** `403 Forbidden`

**Solution:** 
- Check `.npmrc` authentication
- Verify package scope permissions
- Ensure correct `access` setting

### Build Failures

**Error:** `Build failed: Command not found`

**Solution:**
- Check `scripts.build` exists in package.json
- Or set `skipBuild: true`
- Or set `package_build: false`

### Timeout Errors

**Error:** `Command timed out after 300000ms`

**Solution:**
```json
{
  "timeout": 600000
}
```

### Version Already Published

**Error:** `Cannot publish over existing version`

**Solution:**
- Increment version type
- Or manually set new version in config

### Workspace Dependencies

**Issue:** Packages reference workspace versions

**Solution:** Publisher automatically converts:
- `workspace:*` → `1.2.3`
- `workspace:^1.0.0` → `1.2.3`

## Advanced Usage

### Programmatic API

```typescript
import { publishPackages } from '@fluixi/mix-builder';

// Default behavior (reads package-publish.json)
await publishPackages();

// With environment-based configuration
process.env.PUBLISH_TYPE = 'minor';
process.env.PUBLISH_TAG = 'beta';
await publishPackages();
```

### Custom Build Scripts

Add custom build commands to package.json:

```json
{
  "scripts": {
    "build": "tsc && rollup -c",
    "prebuild": "npm run clean",
    "postbuild": "npm run test"
  }
}
```

### Monorepo Setup

For NX monorepo:

```json
{
  "content": "packages/*/package.json",
  "excluded": ["tools", "scripts"],
  "global_build": true
}
```

For Lerna:

```json
{
  "content": "packages/*/package.json",
  "packages_dir": "packages"
}
```

For PNPM workspaces:

```json
{
  "content": "**/packages/*/package.json",
  "excluded_packages": ["!@myorg/*"]
}
```

## Schema Validation

The configuration is validated against JSON Schema:

```json
{
  "$schema": "./node_modules/@fluixi/mix-builder/schemas/publish-config.schema.json"
}
```

Benefits:
- IntelliSense in VSCode
- Validation on load
- Type safety
- Documentation hints

## API Reference

### publishPackages()

Main publishing function.

```typescript
function publishPackages(): Promise<void>
```

**Throws:**
- `Error` - Configuration errors
- `Error` - Build/publish failures

**Side Effects:**
- Creates `.publish-state.json` (temporary)
- Creates `.version-history.json` (persistent)
- Modifies package.json (temporarily)

## Contributing

See main repository CONTRIBUTING.md

## License

MIT

## Support

- GitHub Issues: [Report bugs](https://github.com/org/repo/issues)
- Documentation: [Full docs](https://docs.example.com)
- Examples: [Example configurations](./schemas/publish-config.example.json)