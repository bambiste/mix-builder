// path-resolver.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import {
  resolveOutDir,
  resolveOutputPath,
  resolveOutputPathAbsolute,
} from './base.js';

// Mock process.cwd() to ensure consistent tests
const originalCwd = process.cwd();

describe('resolveOutDir', () => {
  // beforeEach(() => {
  //   // Mock process.cwd() to return a consistent path for tests
  //   vi.spyOn(process, 'cwd').mockReturnValue('/project');
  // });

  // afterEach(() => {
  //   vi.restoreAllMocks();
  // });

  it('should handle absolute entry path with rootDir', () => {
    const entry = {
      filePath:
        '/Users/admin/Desktop/workspace/projects/libs/nx-reactive-workspace/packages/utils/src/lib/array/advanced.ts',
    };
    const options = {
      // baseDir:
      //   '/Users/admin/Desktop/workspace/projects/libs/nx-reactive-workspace/packages/utils',
      rootDir: 'src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options, true);
    console.log('result', result);
    // expect(result).toBe('dist/components/button');
  });
  it('should handle absolute entry path with rootDir', () => {
    const entry = { filePath: '/project/src/components/button/index.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist/components/button');
  });

  it('should use defaults when no options provided', () => {
    const entry = { filePath: '/project/src/index.ts' };
    const result = resolveOutDir(entry as any, {});

    // Without rootDir, preserve full path relative to baseDir
    expect(result).toBe('dist/src');
  });

  it('should handle relative rootDir', () => {
    const entry = { filePath: '/project/src/utils/helpers.ts' };
    const options = {
      rootDir: './src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist/utils');
  });

  it('should handle rootDir as subdirectory string', () => {
    const entry = { filePath: '/project/src/app/home/page.tsx' };
    const options = {
      rootDir: 'src',
      outdir: 'build',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('build/app/home');
  });

  it('should handle custom baseDir', () => {
    const entry = { filePath: '/project/packages/core/src/index.ts' };
    const options = {
      baseDir: '/project/packages/core',
      rootDir: 'src',
      outdir: 'lib',
    };

    const result = resolveOutDir(entry as any, options);
    // Relative to baseDir which is now '/project/packages/core'
    expect(result).toBe('lib');
  });

  it('should handle relative baseDir', () => {
    const entry = { filePath: '/project/packages/utils/src/index.ts' };
    const options = {
      baseDir: './packages/utils',
      rootDir: 'src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist');
  });

  it('should handle entry directly in rootDir', () => {
    const entry = { filePath: '/project/src/main.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: 'out',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('out');
  });

  it('should handle entry outside rootDir (goes to outdir root)', () => {
    const entry = { filePath: '/project/scripts/build.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    // Entry outside rootDir goes directly to outdir root
    expect(result).toBe('dist');
  });

  it('should handle absolute outdir path (returns relative to cwd)', () => {
    const entry = { filePath: '/project/src/components/header.tsx' };
    const options = {
      rootDir: '/project/src',
      outdir: '/absolute/output',
    };

    const result = resolveOutDir(entry as any, options);
    // Even with absolute outdir, we return path relative to cwd
    // But outdir is absolute, so we need to handle it specially
    // Actually, the function returns the outdir as given, so it stays absolute
    expect(result).toBe(path.normalize('/absolute/output/components'));
  });

  // it('should handle Windows-style paths on Windows', () => {
  //   // Mock path.sep to simulate Windows
  //   const originalSep = path.sep;
  //   Object.defineProperty(path, 'sep', { value: '\\' });

  //   try {
  //     const entry = { filePath: 'C:\\project\\src\\app\\index.ts' };
  //     const options = {
  //       baseDir: 'C:\\project',
  //       rootDir: 'src',
  //       outdir: 'dist',
  //     };

  //     vi.spyOn(process, 'cwd').mockReturnValue('C:\\project');

  //     const result = resolveOutDir(entry as any, options);
  //     // Should return with Windows separators
  //     expect(result).toBe('dist\\app');
  //   } finally {
  //     Object.defineProperty(path, 'sep', { value: originalSep });
  //   }
  // });

  it('should handle nested rootDir', () => {
    const entry = {
      filePath: '/project/packages/app/src/features/dashboard.ts',
    };
    const options = {
      baseDir: '/project',
      rootDir: 'packages/app/src',
      outdir: 'packages/app/dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('packages/app/dist/features');
  });

  it('should handle empty outdir (defaults to dist)', () => {
    const entry = { filePath: '/project/src/index.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: '',
    };

    const result = resolveOutDir(entry as any, options);
    // Empty outdir defaults to 'dist'
    expect(result).toBe('dist');
  });

  it('should preserve directory structure when entry is under baseDir but not under rootDir', () => {
    const entry = { filePath: '/project/src/utils/helpers/math.ts' };
    const options = {
      rootDir: '/project',
      outdir: 'output',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('output/src/utils/helpers');
  });

  it('should handle relative entry paths', () => {
    const entry = { filePath: './src/app/index.ts' };
    const options = {
      rootDir: 'src',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist/app');
  });

  it('should handle when rootDir is deeper than entry path', () => {
    const entry = { filePath: '/project/src/index.ts' };
    const options = {
      rootDir: '/project/src/app',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    // Entry is outside rootDir, so goes to dist root
    expect(result).toBe('dist');
  });

  it('should handle dot notation in paths', () => {
    const entry = { filePath: '/project/./src/../src/app/index.ts' };
    const options = {
      baseDir: '.',
      rootDir: './src',
      outdir: './dist',
    };

    const result = resolveOutDir(entry as any, options);
    // Paths get normalized
    expect(result).toBe('dist/app');
  });

  it('should handle when outdir is current directory', () => {
    const entry = { filePath: '/project/src/app/index.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: 'app',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('app/app');
  });

  it('should handle complex nested structure with file extension', () => {
    const entry = {
      filePath:
        '/project/packages/ui/src/components/common/buttons/primary/index.tsx',
    };
    const options = {
      baseDir: '/project/packages/ui',
      rootDir: 'src',
      outdir: 'lib',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('lib/components/common/buttons/primary');
  });
});

describe('resolveOutputPath', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return full relative output path', () => {
    const entry = { filePath: '/project/src/components/button.tsx' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist',
    };

    const result = resolveOutputPath(entry as any, options);

    expect(result).toEqual({
      outDir: 'dist/components',
      outputPath: 'dist/components/button.tsx',
      fileName: 'button.tsx',
    });
  });

  it('should handle entry at root level', () => {
    const entry = { filePath: '/project/src/main.ts' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist',
    };

    const result = resolveOutputPath(entry as any, options);

    expect(result.outDir).toBe('dist');
    expect(result.outputPath).toBe('dist/main.ts');
  });
});

describe('resolveOutputPathAbsolute', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return both relative and absolute paths', () => {
    const entry = { filePath: '/project/src/components/button.tsx' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist',
    };

    const result = resolveOutputPathAbsolute(entry as any, options);

    expect(result.relativeOutDir).toBe('dist/components');
    expect(result.relativeOutputPath).toBe('dist/components/button.tsx');
    expect(result.outDir).toBe('/project/dist/components');
    expect(result.outputPath).toBe('/project/dist/components/button.tsx');
    expect(result.fileName).toBe('button.tsx');
  });
});

describe('Path normalization', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // it('should normalize path separators', () => {
  //   const entry = { filePath: '/project/src\\components\\button.tsx' };
  //   const options = {
  //     rootDir: '/project/src',
  //     outdir: 'dist',
  //   };

  //   const result = resolveOutDir(entry as any, options);
  //   // Mixed separators should be normalized
  //   expect(result).toBe('dist/components');
  // });

  it('should handle trailing slashes in rootDir', () => {
    const entry = { filePath: '/project/src/components/button.tsx' };
    const options = {
      rootDir: '/project/src/',
      outdir: 'dist',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist/components');
  });

  it('should handle trailing slashes in outdir', () => {
    const entry = { filePath: '/project/src/components/button.tsx' };
    const options = {
      rootDir: '/project/src',
      outdir: 'dist/',
    };

    const result = resolveOutDir(entry as any, options);
    expect(result).toBe('dist/components');
  });
});
