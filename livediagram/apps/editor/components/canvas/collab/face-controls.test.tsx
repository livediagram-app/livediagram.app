// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import { useFaceControls, usePublishFaceControls, type FaceControl } from './face-controls';

afterEach(cleanup);

const control = (key: string, run = vi.fn()): FaceControl => ({
  key,
  label: key,
  description: '',
  icon: 'reset',
  run,
});

function Face({ id, controls }: { id: string; controls: (FaceControl | false)[] }) {
  usePublishFaceControls(id, controls);
  return null;
}

describe('face controls', () => {
  it('offers what the face can do now, and nothing for another element', () => {
    render(<Face id="quiz" controls={[control('edit'), false, control('start')]} />);
    expect(renderHook(() => useFaceControls('quiz')).result.current.map((c) => c.key)).toEqual([
      'edit',
      'start',
    ]);
    expect(renderHook(() => useFaceControls('other')).result.current).toEqual([]);
    expect(renderHook(() => useFaceControls(null)).result.current).toEqual([]);
  });

  it('follows the face as its phase changes, and runs the latest handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Face id="quiz" controls={[control('start', first)]} />);
    const read = renderHook(() => useFaceControls('quiz'));
    view.rerender(<Face id="quiz" controls={[control('start', second)]} />);
    read.result.current[0]!.run();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    view.rerender(<Face id="quiz" controls={[control('reveal'), control('reset')]} />);
    expect(read.result.current.map((c) => c.key)).toEqual(['reveal', 'reset']);
    view.rerender(<Face id="quiz" controls={[]} />);
    expect(read.result.current).toEqual([]);
  });

  it('takes its offer away with the face', () => {
    const view = render(<Face id="gone" controls={[control('reset')]} />);
    const read = renderHook(() => useFaceControls('gone'));
    expect(read.result.current).toHaveLength(1);
    view.unmount();
    expect(read.result.current).toEqual([]);
  });
});
