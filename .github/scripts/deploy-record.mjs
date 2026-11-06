// The commit each environment last deployed in full (docs/ci.md "Deploys"), kept as a GitHub
// deployment of that commit to the environment with the task `record` and a `success` status. Until
// 2026-11-06 it was the tag `deployed/<environment>`, which the workflow's GITHUB_TOKEN may not move
// across a change to .github/workflows/; a deployment is not a ref, so it never meets that check.
//
//   node .github/scripts/deploy-record.mjs read <environment>         -> sha=<sha or empty>
//   node .github/scripts/deploy-record.mjs write <environment> <sha>  -> records <sha>
//
// `read` writes `sha=` to $GITHUB_OUTPUT (and prints the sha); it fails on an API error, so a deploy
// never plans from a record it couldn't read. `write` never fails the run: the Workers have deployed
// by then, and a missing record only makes the next deploy redeploy a little more, so it warns.
// Both need GITHUB_TOKEN (deployments: read or write) and GITHUB_REPOSITORY.

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TASK = 'record';
// The newest few records are enough: each is written with its success status straight away, so a
// record without one is a write that failed halfway, and the one before it stands.
const SCANNED = 10;

// The newest deployment that has a success status among its statuses. A later deployment to the same
// environment can add an `inactive` status on top, so the newest status alone doesn't say.
export async function newestSuccessful(deployments, statusesOf) {
  for (const deployment of deployments) {
    const statuses = await statusesOf(deployment.id);
    if (statuses.some((status) => status.state === 'success')) return deployment.sha;
  }
  return '';
}

export function client({ token, repo, fetchImpl = fetch }) {
  const base = `https://api.github.com/repos/${repo}`;
  return async function api(path, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetchImpl(`${base}/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok)
      throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
}

// The old tag, for an environment with no record yet. Lightweight or annotated.
async function tagCommit(api, environment) {
  const ref = await api(`git/ref/tags/deployed/${environment}`, { allow404: true });
  if (!ref) return '';
  if (ref.object.type !== 'tag') return ref.object.sha;
  const tag = await api(`git/tags/${ref.object.sha}`);
  return tag.object.sha;
}

export async function readRecord(api, environment) {
  const env = encodeURIComponent(environment);
  const deployments = await api(`deployments?environment=${env}&task=${TASK}&per_page=${SCANNED}`);
  const sha = await newestSuccessful(deployments, (id) =>
    api(`deployments/${id}/statuses?per_page=100`),
  );
  if (sha) return { sha, from: 'record' };
  const tagged = await tagCommit(api, environment);
  return { sha: tagged, from: tagged ? `tag deployed/${environment}` : 'none' };
}

export async function writeRecord(api, environment, sha, logUrl) {
  const deployment = await api('deployments', {
    method: 'POST',
    body: {
      ref: sha,
      task: TASK,
      environment,
      auto_merge: false,
      required_contexts: [],
      production_environment: environment === 'production',
      description: `${environment} runs ${sha}`,
    },
  });
  await api(`deployments/${deployment.id}/statuses`, {
    method: 'POST',
    body: { state: 'success', log_url: logUrl, description: 'Every Worker deployed' },
  });
  return deployment.id;
}

function append(file, line) {
  if (file) appendFileSync(file, `${line}\n`);
}

export async function main(argv = process.argv.slice(2), env = process.env, fetchImpl = fetch) {
  const [command, environment, sha] = argv;
  const api = client({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, fetchImpl });
  if (command === 'read' && environment) {
    const record = await readRecord(api, environment);
    console.error(
      `[deploy-record] ${environment} runs ${record.sha || 'nothing yet'} (${record.from})`,
    );
    console.log(record.sha);
    append(env.GITHUB_OUTPUT, `sha=${record.sha}`);
    return 0;
  }
  if (command === 'write' && environment && sha) {
    const logUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
    try {
      const id = await writeRecord(api, environment, sha, logUrl);
      console.error(`[deploy-record] recorded ${environment} at ${sha} (deployment ${id})`);
      append(env.GITHUB_STEP_SUMMARY, `${environment} runs \`${sha}\`.`);
    } catch (error) {
      // Not a deploy failure: every Worker is up. The next deploy plans from the older record.
      console.log(
        `::warning::Every Worker deployed, but recording ${environment} at ${sha} failed: ${error}`,
      );
      append(
        env.GITHUB_STEP_SUMMARY,
        `${environment} runs \`${sha}\`, but the record failed, so the next deploy plans from the one before.`,
      );
    }
    return 0;
  }
  console.error('usage: deploy-record.mjs read <environment> | write <environment> <sha>');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
