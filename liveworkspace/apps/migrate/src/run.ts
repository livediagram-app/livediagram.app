// The real Runner and Http apply and verify use (the tests hand in fakes): a child process per wrangler run, with
// only the environment it was given, and fetch.
import { spawn } from 'node:child_process';
import type { Command, Http, HttpRequest, HttpResponse, Runner, RunResult } from './apply.ts';

export const processRunner: Runner = {
  run(command: Command): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      const [bin, ...args] = command.argv;
      const child = spawn(bin!, args, {
        cwd: command.cwd,
        env: command.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
  },
};

// A door slower than this is taken as failed; the unit is retried on the next run.
const DOOR_TIMEOUT_MS = 120_000;

export const fetchHttp: Http = {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(DOOR_TIMEOUT_MS),
    });
    return { status: response.status, body: await response.text() };
  },
};
