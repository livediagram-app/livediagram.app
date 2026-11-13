// @vitest-environment jsdom
// The upload transport that reports bytes sent (xhr-fetch.ts): the Response it answers, its progress, and failing,
// aborting and a blocked request as fetch does. A fake XMLHttpRequest stands in for the browser's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { xhrFetch } from './xhr-fetch';

class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  responseType = '';
  withCredentials = false;
  headers: Record<string, string> = {};
  body: unknown = undefined;
  status = 0;
  statusText = '';
  response: unknown = null;
  rawHeaders = '';
  aborted = false;
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  getAllResponseHeaders() {
    return this.rawHeaders;
  }
  // The server answers.
  answer(status: number, body: string | null, headers = '') {
    this.status = status;
    this.statusText = status === 201 ? 'Created' : '';
    this.response = body === null ? null : new TextEncoder().encode(body).buffer;
    this.rawHeaders = headers;
    this.onload?.();
  }
}

beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
afterEach(() => vi.unstubAllGlobals());

describe('xhrFetch', () => {
  it('sends the request with its headers and answers the Response the server sent', async () => {
    const progress = vi.fn();
    const pending = xhrFetch(
      '/api/images',
      {
        method: 'post',
        headers: { 'Content-Type': 'image/png', 'Content-Length': '3', 'X-Share-Code': 'C1' },
        body: 'abc',
      },
      progress,
    );
    const x = FakeXhr.last;
    expect(x.method).toBe('POST');
    expect(x.url).toBe('/api/images');
    expect(x.responseType).toBe('arraybuffer');
    expect(x.withCredentials).toBe(false);
    // The browser sets Content-Length itself, and refuses it from script.
    expect(x.headers).toEqual({ 'content-type': 'image/png', 'x-share-code': 'C1' });
    expect(x.body).toBe('abc');
    x.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 3 });
    x.upload.onprogress!({ lengthComputable: false, loaded: 2, total: 0 });
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith(1, 3);
    x.answer(
      201,
      '{"ok":true}',
      'content-type: application/json\r\nx-build-id: b7\r\n\r\nbroken line',
    );
    const res = await pending;
    expect(res.status).toBe(201);
    expect(res.statusText).toBe('Created');
    expect(res.headers.get('X-Build-Id')).toBe('b7');
    expect(res.headers.get('content-type')).toBe('application/json');
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('sends a GET with no body and credentials when asked, and answers a bodiless status without one', async () => {
    const pending = xhrFetch('/api/x', { credentials: 'include' }, vi.fn());
    const x = FakeXhr.last;
    expect(x.method).toBe('GET');
    expect(x.withCredentials).toBe(true);
    expect(x.body).toBeNull();
    x.answer(204, 'ignored');
    const res = await pending;
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it('answers an error status as a Response, as fetch does', async () => {
    const pending = xhrFetch('/api/x', undefined, vi.fn());
    FakeXhr.last.answer(413, '{"error":"file_too_large"}');
    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
  });

  it('rejects with a TypeError when no response comes, as fetch does', async () => {
    const failed = xhrFetch('/api/x', undefined, vi.fn());
    FakeXhr.last.onerror!();
    await expect(failed).rejects.toBeInstanceOf(TypeError);
    const timedOut = xhrFetch('/api/x', undefined, vi.fn());
    FakeXhr.last.ontimeout!();
    await expect(timedOut).rejects.toBeInstanceOf(TypeError);
    const blocked = xhrFetch('/api/x', undefined, vi.fn());
    FakeXhr.last.answer(0, null);
    await expect(blocked).rejects.toBeInstanceOf(TypeError);
  });

  it('aborts on its signal with the signal’s reason, and stops listening once settled', async () => {
    const controller = new AbortController();
    const pending = xhrFetch('/api/x', { signal: controller.signal }, vi.fn());
    const x = FakeXhr.last;
    const reason = new DOMException('Stopped', 'AbortError');
    controller.abort(reason);
    expect(x.aborted).toBe(true);
    await expect(pending).rejects.toBe(reason);

    const done = new AbortController();
    const remove = vi.spyOn(done.signal, 'removeEventListener');
    const answered = xhrFetch('/api/x', { signal: done.signal }, vi.fn());
    FakeXhr.last.answer(200, 'ok');
    await answered;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('rejects at once with an AbortError on a signal already aborted, sending nothing', async () => {
    const before = FakeXhr.last;
    const controller = new AbortController();
    controller.abort();
    await expect(xhrFetch('/api/x', { signal: controller.signal }, vi.fn())).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(FakeXhr.last).toBe(before);
  });

  it('rejects with an AbortError when the request is aborted with no signal reason', async () => {
    const pending = xhrFetch('/api/x', undefined, vi.fn());
    FakeXhr.last.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
