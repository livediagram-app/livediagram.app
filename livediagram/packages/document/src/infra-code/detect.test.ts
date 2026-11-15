import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { baseName, detectInfraFormat } from './detect';

describe('detectInfraFormat', () => {
  it('reads the format from a file name first', () => {
    expect(detectInfraFormat('wrangler.toml', 'services:\n')).toBe('wrangler');
    expect(detectInfraFormat('apps/api/Wrangler.TOML', '')).toBe('wrangler');
    expect(detectInfraFormat('other.toml', '')).toBe('wrangler');
    expect(detectInfraFormat('docker-compose.yml', 'name = "x"')).toBe('compose');
    expect(detectInfraFormat('compose.prod.yaml', '')).toBe('compose');
    expect(detectInfraFormat('C:\\repo\\stack.yaml', '')).toBe('compose');
    expect(detectInfraFormat('infra.yml', '')).toBe('compose');
  });

  it('reads a paste, or a name that says nothing, by its content', () => {
    expect(detectInfraFormat(undefined, 'version: "3"\nservices:\n  web: {}')).toBe('compose');
    expect(detectInfraFormat('notes.txt', 'services :\n  web: {}')).toBe('compose');
    expect(detectInfraFormat(undefined, 'name = "api"\n[[kv_namespaces]]')).toBe('wrangler');
    // Indented `services:` is a nested key, not Compose's top level.
    expect(detectInfraFormat(undefined, 'x:\n  services: 1')).toBe('wrangler');
    expect(detectInfraFormat(undefined, 'servicesx: 1')).toBe('wrangler');
  });

  it('scans a long paste in linear time', () => {
    const text = `${'a\n'.repeat(200_000)}${' '.repeat(50_000)}services`;
    expect(cpuMsOf(() => detectInfraFormat(undefined, text))).toBeLessThan(cpuBudgetMs(100));
  });

  it('takes the base name of a path', () => {
    expect(baseName('a/b/Compose.yml')).toBe('compose.yml');
    expect(baseName('plain')).toBe('plain');
  });
});
