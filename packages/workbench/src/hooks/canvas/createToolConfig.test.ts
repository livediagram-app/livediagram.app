// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../bindings', () => ({ workbench: { track } }));

const { createToolConfig } = await import('./createToolConfig');

describe('createToolConfig', () => {
  it('starts from storage, saves a changed field and counts which one changed', () => {
    const save = vi.fn();
    const useConfig = createToolConfig({
      load: () => ({ width: 2, colour: 'red' }),
      save,
      telemetryType: { width: 'PenWidth', colour: 'PenColour' },
    });
    const { result } = renderHook(() => useConfig());
    expect(result.current.config).toEqual({ width: 2, colour: 'red' });
    act(() => result.current.setField('width', 2));
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.setField('width', 4));
    expect(result.current.config).toEqual({ width: 4, colour: 'red' });
    expect(save).toHaveBeenCalledWith({ width: 4, colour: 'red' });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PenWidth');
  });
});
