import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SKIP_TYPECHECK_ENV,
  isTurbopack,
  livediagramNextConfig,
  typescriptConfig,
} from './index.js';

describe('typescriptConfig', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the type check when the variable is unset', () => {
    expect(typescriptConfig({})).toEqual({ ignoreBuildErrors: false });
  });

  it('keeps the type check for any value but 1', () => {
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: 'true' })).toEqual({
      ignoreBuildErrors: false,
    });
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: '0' })).toEqual({ ignoreBuildErrors: false });
  });

  it('skips the type check and says so when the variable is 1', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(typescriptConfig({ [SKIP_TYPECHECK_ENV]: '1' })).toEqual({ ignoreBuildErrors: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skips its type check'));
  });
});

describe('isTurbopack', () => {
  it('is true when Next set TURBOPACK', () => {
    expect(isTurbopack({ TURBOPACK: '1' })).toBe(true);
  });

  it('is false under webpack', () => {
    expect(isTurbopack({})).toBe(false);
  });
});

describe('livediagramNextConfig', () => {
  afterEach(() => vi.restoreAllMocks());
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});
  const now = new Date('2027-03-01T12:00:00Z');

  it('exports statically by default, in dev too', () => {
    quiet();
    expect(livediagramNextConfig({ env: {}, now }).output).toBe('export');
  });

  it('leaves the editor dev server dynamic and exports its production build', () => {
    quiet();
    expect(livediagramNextConfig({ env: {}, exportInDev: false, now }).output).toBeUndefined();
    expect(
      livediagramNextConfig({ env: { NODE_ENV: 'production' }, exportInDev: false, now }).output,
    ).toBe('export');
  });

  it('builds into NEXT_DISTDIR, else .next', () => {
    quiet();
    expect(livediagramNextConfig({ env: {}, now }).distDir).toBe('.next');
    expect(livediagramNextConfig({ env: { NEXT_DISTDIR: '.next-dev' }, now }).distDir).toBe(
      '.next-dev',
    );
  });

  it('shares unoptimised images, the type check switch and the build year', () => {
    quiet();
    const config = livediagramNextConfig({ env: { [SKIP_TYPECHECK_ENV]: '1' }, now });
    expect(config.images).toEqual({ unoptimized: true });
    expect(config.typescript).toEqual({ ignoreBuildErrors: true });
    expect(config.env).toEqual({ NEXT_PUBLIC_BUILD_YEAR: '2027' });
  });

  it('writes no AGENTS.md and points agents at the latest release', () => {
    quiet();
    const config = livediagramNextConfig({ env: {}, now });
    expect(config.agentRules).toBe(false);
    expect(config.experimental?.agentUpgrade).toBe('latest');
  });

  it('runs the Rust React Compiler for an app that asks for it, under Turbopack', () => {
    quiet();
    const config = livediagramNextConfig({ env: { TURBOPACK: '1' }, reactCompiler: true, now });
    expect(config.reactCompiler).toBe(true);
    expect(config.experimental).toEqual({
      agentUpgrade: 'latest',
      turbopackRustReactCompiler: true,
      turbopackGc: true,
      turbopackLazyDynamicImports: true,
    });
  });

  // docs/specs/016-platform/nextjs.md: the compiler costs first-load JavaScript on pages that rarely re-render, so only
  // the editor runs it.
  it('leaves the compiler off by default, keeping the Turbopack flags', () => {
    quiet();
    const config = livediagramNextConfig({ env: { TURBOPACK: '1' }, now });
    expect(config.reactCompiler).toBeUndefined();
    expect(config.experimental).toEqual({
      agentUpgrade: 'latest',
      turbopackGc: true,
      turbopackLazyDynamicImports: true,
    });
  });

  it('leaves the compiler and every Turbopack flag off under webpack', () => {
    quiet();
    const config = livediagramNextConfig({ env: {}, reactCompiler: true, now });
    expect(config.reactCompiler).toBeUndefined();
    expect(config.experimental).toEqual({ agentUpgrade: 'latest' });
  });

  it('logs what the build runs with', () => {
    const log = quiet();
    livediagramNextConfig({ env: { TURBOPACK: '1' }, reactCompiler: true, now });
    expect(log).toHaveBeenCalledWith('[next-config] turbopack=true export=true compiler=true');
    livediagramNextConfig({ env: { TURBOPACK: '1' }, now });
    expect(log).toHaveBeenCalledWith('[next-config] turbopack=true export=true compiler=false');
  });
});
