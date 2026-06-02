# Copy Files Feature - Summary

## 🎯 Overview

Added advanced file copying functionality to Mix Builder with support for glob patterns, transformations, and flexible destination paths. This feature is available for both Rollup and ESBuild configurations.

## ✨ New Features

### 1. Glob Pattern Support
- Copy files using glob patterns
- Support for recursive patterns (`**/*`)
- Multiple file type matching (`*.{js,ts,json}`)
- Advanced pattern matching with fast-glob

### 2. Flexible Copying Options
- **`from`**: Source path(s) or glob pattern(s)
- **`to`**: Destination path relative to output
- **`flatten`**: Flatten directory structure
- **`rename`**: Rename files during copy
- **`transform`**: Transform file contents

### 3. Multiple Builder Support
- Works with ESBuild builder
- Works with Rollup builder
- Consistent API across both builders

## 📊 Changes Made

### Files Modified/Created

1. **`rollup/builder.ts`** (FIXED & ENHANCED)
   - Fixed plugin import issues
   - Added `copyFiles` interface
   - Implemented glob pattern resolution
   - Added transform support
   - Added flatten and rename support

2. **`esbuild/base.ts`** (ENHANCED)
   - Added `copyFiles` interface to `EsbuildBuilderConfig`
   - Added transform and rename function types

3. **`esbuild/builder.ts`** (ENHANCED)
   - Implemented `processCopyFiles` function
   - Added glob pattern resolution
   - Added file transformation support
   - Added flatten and rename support

4. **`schema/build-config.schema.json`** (ENHANCED)
   - Added `copyFiles` schema for Rollup
   - Added `copyFiles` schema for ESBuild
   - Comprehensive validation rules
   - Documentation in schema

5. **`docs/docs/mix-builder/copy-files.md`** (NEW)
   - Complete documentation (673 lines)
   - Examples and use cases
   - Best practices
   - Troubleshooting guide

## 🎨 Configuration Examples

### Basic Usage

```json
{
  "esbuild": {
    "entries": ["src/index.ts"],
    "copyFiles": [
      {
        "from": "README.md",
        "to": "."
      }
    ]
  }
}
```

### Glob Patterns

```json
{
  "copyFiles": [
    {
      "from": "assets/**/*.{png,jpg,svg}",
      "to": "static/images"
    }
  ]
}
```

### Multiple Sources

```json
{
  "copyFiles": [
    {
      "from": ["README.md", "LICENSE", "CHANGELOG.md"],
      "to": "docs"
    }
  ]
}
```

### Flatten Structure

```json
{
  "copyFiles": [
    {
      "from": "src/**/icons/**/*.svg",
      "to": "icons",
      "flatten": true
    }
  ]
}
```

### Transform Contents

```json
{
  "copyFiles": [
    {
      "from": "package.json",
      "to": ".",
      "transform": "(contents) => { const pkg = JSON.parse(contents); delete pkg.devDependencies; return JSON.stringify(pkg, null, 2); }"
    }
  ]
}
```

### Rename Files

```json
{
  "copyFiles": [
    {
      "from": "config.json",
      "to": ".",
      "rename": "(name, ext) => name + '.prod' + ext"
    }
  ]
}
```

## 🔧 Technical Implementation

### Rollup Builder

```typescript
// Plugin imports fixed with proper default handling
const babel = (babelPlugin as any).default || babelPlugin;
const commonjs = (commonjsPlugin as any).default || commonjsPlugin;
const terser = (terserPlugin as any).default || terserPlugin;
const json = (jsonPlugin as any).default || jsonPlugin;
const typescript = (typescriptPlugin as any).default || typescriptPlugin;
const copyPlugin = (copyPluginModule as any).default || copyPluginModule;

// Glob pattern resolution
for (const source of sources) {
  if (source.includes('*') || source.includes('?')) {
    const matches = await glob(source, {
      cwd: process.cwd(),
      absolute: false,
    });
    files.push(...matches);
  } else {
    files.push(source);
  }
}
```

### ESBuild Builder

```typescript
// Dedicated processCopyFiles function
async function processCopyFiles(
  copyFilesConfig: EsbuildBuilderConfig['copyFiles'],
  outputDir: string,
  log: boolean = true
): Promise<void> {
  // Resolve globs
  // Handle flatten
  // Apply transforms
  // Rename files
  // Copy to destination
}
```

## 📋 Schema Definition

```json
{
  "copyFiles": {
    "description": "Advanced file copying with glob pattern support",
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "from": {
          "description": "Source path or glob pattern(s)",
          "oneOf": [
            { "type": "string" },
            { "type": "array", "items": { "type": "string" } }
          ]
        },
        "to": {
          "description": "Destination path",
          "type": "string"
        },
        "flatten": {
          "description": "Flatten directory structure",
          "type": "boolean",
          "default": false
        },
        "rename": {
          "description": "Rename pattern or function name",
          "type": "string"
        }
      },
      "required": ["from", "to"]
    }
  }
}
```

## 🎯 Use Cases

### 1. Component Library
```json
{
  "copyFiles": [
    { "from": "README.md", "to": "." },
    { "from": "src/assets/**/*.css", "to": "styles" },
    { "from": "src/assets/icons/**/*.svg", "to": "icons", "flatten": true }
  ]
}
```

### 2. NPM Package
```json
{
  "copyFiles": [
    { "from": ["README.md", "LICENSE"], "to": "." },
    { 
      "from": "package.json", 
      "to": ".",
      "transform": "(c) => { const p = JSON.parse(c); delete p.devDependencies; return JSON.stringify(p, null, 2); }"
    }
  ]
}
```

### 3. Full-Stack App
```json
{
  "copyFiles": [
    { "from": "public/**/*", "to": "public" },
    { "from": "assets/images/**/*.{png,jpg,webp}", "to": "assets/images" },
    { "from": "assets/fonts/**/*.{woff,woff2}", "to": "assets/fonts" },
    { "from": "locales/**/*.json", "to": "locales" }
  ]
}
```

## 🐛 Bug Fixes

### Rollup Builder Imports
**Problem:** TypeScript errors on Rollup plugin imports
```
error: This expression is not callable.
Type 'typeof import("...@rollup/plugin-babel...")' has no call signatures.
```

**Solution:** Fixed with proper default export handling
```typescript
import * as babelPlugin from '@rollup/plugin-babel';
const babel = (babelPlugin as any).default || babelPlugin;
```

Applied to all Rollup plugins:
- @rollup/plugin-babel
- @rollup/plugin-commonjs
- @rollup/plugin-terser
- @rollup/plugin-json
- @rollup/plugin-typescript
- rollup-plugin-copy

## 📈 Benefits

1. **No Manual Copying** - Automated file copying during build
2. **Glob Patterns** - Match multiple files easily
3. **Transformations** - Modify file contents during copy
4. **Flexibility** - Flatten, rename, and organize files
5. **Clean Output** - Maintain desired directory structure
6. **Both Builders** - Consistent API across Rollup and ESBuild

## 🎓 Best Practices

1. **Use Glob Patterns** for multiple files
2. **Flatten Icons** for simpler access
3. **Transform package.json** to remove dev dependencies
4. **Copy Essential Files** (README, LICENSE)
5. **Organize by Type** (images, fonts, data)
6. **Preserve Structure** for documentation
7. **Test Patterns** before committing

## 📚 Documentation

Complete documentation available at:
- `/docs/docs/mix-builder/copy-files.md` (673 lines)
- Includes:
  - Basic usage
  - All configuration options
  - Glob pattern guide
  - Advanced features
  - 6 complete examples
  - Best practices
  - Troubleshooting
  - Pattern reference table

## 🔗 Related Features

- **copy**: Legacy simple file copy (still supported)
- **copy_pkg**: Copy package.json (still supported)
- **copyFiles**: New advanced copy with globs (recommended)

## ✅ Testing Checklist

- [x] Basic file copy
- [x] Glob pattern resolution
- [x] Multiple source files
- [x] Flatten directory structure
- [x] File transformation
- [x] File renaming
- [x] ESBuild integration
- [x] Rollup integration
- [x] Schema validation
- [x] Documentation

## 📊 Statistics

- **Lines Added:** ~350
- **Files Modified:** 5
- **Files Created:** 1 (documentation)
- **Documentation Lines:** 673
- **Examples Provided:** 15+
- **Bug Fixes:** 6 (Rollup plugin imports)

## 🚀 Future Enhancements

- [ ] Exclude patterns (negative globs)
- [ ] Watch mode support
- [ ] Copy on change only
- [ ] Compression during copy
- [ ] Checksum verification
- [ ] Parallel copy operations
- [ ] Copy progress reporting

---

**Version:** 2.1.0  
**Feature:** copyFiles  
**Status:** ✅ Complete  
**Breaking Changes:** None (backward compatible)  
**Documentation:** Complete  

🎉 **Ready for Production Use!**