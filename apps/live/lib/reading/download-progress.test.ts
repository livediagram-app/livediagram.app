import { describe, expect, it } from 'vitest';
import { downloadProgress } from './download-progress';

// The in-browser reader's model is ~160 MB, fetched once and cached. The
// library reports it FILE BY FILE (a processor config, a tokenizer, three
// model files…); the author wants one bar.
describe('downloadProgress', () => {
  it('adds every file it has heard of into one figure', () => {
    const p = downloadProgress();
    p.update({ status: 'progress', file: 'a.onnx', loaded: 10, total: 100 });
    p.update({ status: 'progress', file: 'b.onnx', loaded: 20, total: 50 });
    expect(p.current()).toEqual({ loaded: 30, total: 150, done: false });
  });

  it('follows a file forward, never counting it twice', () => {
    const p = downloadProgress();
    p.update({ status: 'progress', file: 'a.onnx', loaded: 10, total: 100 });
    p.update({ status: 'progress', file: 'a.onnx', loaded: 60, total: 100 });
    expect(p.current()).toMatchObject({ loaded: 60, total: 100 });
  });

  it('counts a finished file as whole', () => {
    const p = downloadProgress();
    p.update({ status: 'progress', file: 'a.onnx', loaded: 99, total: 100 });
    p.update({ status: 'done', file: 'a.onnx' });
    expect(p.current()).toMatchObject({ loaded: 100, total: 100 });
  });

  it('says it is done when the library says the model is ready', () => {
    const p = downloadProgress();
    p.update({ status: 'progress', file: 'a.onnx', loaded: 100, total: 100 });
    p.update({ status: 'ready' });
    expect(p.current().done).toBe(true);
  });

  it('ignores events it cannot use, rather than showing nonsense', () => {
    const p = downloadProgress();
    p.update({ status: 'initiate', file: 'a.onnx' });
    p.update({ status: 'progress', file: 'b.onnx', loaded: 5 });
    p.update({ status: 'progress', file: 'c.onnx', loaded: 5, total: 0 });
    expect(p.current()).toEqual({ loaded: 0, total: 0, done: false });
  });
});

describe('downloadProgress, counting only the weights', () => {
  it('ignores the small config files that arrive before the weights', () => {
    // A config of a few KB, complete before any weight has started, read as
    // "100% of 0 MB" for a moment. Only the files the bar is FOR count.
    const p = downloadProgress({ counts: (file) => file.endsWith('.onnx') });
    p.update({ status: 'progress', file: 'config.json', loaded: 900, total: 900 });
    expect(p.current()).toEqual({ loaded: 0, total: 0, done: false });
    p.update({ status: 'progress', file: 'onnx/decoder_q4.onnx', loaded: 5, total: 50 });
    expect(p.current()).toMatchObject({ loaded: 5, total: 50 });
  });
});
