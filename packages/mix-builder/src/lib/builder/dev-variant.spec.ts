import { describe, expect, it } from 'vitest';
import { esbuildVariants } from './orchestrator.js';

describe('esbuild development variant', () => {
  it('builds once when no development build is asked for', () => {
    const conf = { define: { X: '1' } };
    expect(esbuildVariants(conf, 'dist')).toEqual([conf]);
  });

  it('adds a development build to dist/dev, with __DEV__ true and NODE_ENV development', () => {
    const [main, dev] = esbuildVariants({ development: true, define: { X: '1' }, clean: true }, 'dist');
    expect(main.define).toEqual({ X: '1', __DEV__: 'false' });
    expect(dev).toMatchObject({ outdir: 'dist/dev', nodeEnv: 'development', clean: false });
    expect(dev.define).toEqual({ X: '1', __DEV__: 'true' });
  });

  it('honours an outdir for the development build', () => {
    const [, dev] = esbuildVariants({ development: { outdir: 'dist-dev' } }, 'dist');
    expect(dev.outdir).toBe('dist-dev');
  });
});
