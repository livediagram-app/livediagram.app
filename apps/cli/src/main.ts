// One command, start to end (docs/specs/015-api/blueprints/cli.md "One command"): global flags, routing, help,
// the verb's input, the profile and credential, the host's capabilities, the handler, and what it prints. The
// exit code is one of eight; stdout carries data only.

import { renderSkill, type Verb, type VerbContext } from '@livediagram/agent-verbs';
import { resolveCredential } from './auth/credentials';
import { callApi, guideOf, installSkill, login, logout, status } from './commands/local';
import { loadCapabilities } from './config/capabilities';
import { readConfig, resolveProfile, type Profile } from './config/profiles';
import { CLI_VERSION, isBelow } from './config/version';
import { debugLog, type DebugLog } from './debug';
import { fieldsOf } from './dispatch/fields';
import { splitGlobals, type Globals } from './dispatch/globals';
import { parseVerbArgs } from './dispatch/parse-flags';
import { route } from './dispatch/route';
import { resourceHelp, topHelp, verbHelp } from './help/help';
import type { CliIo } from './io';
import { CliError, formatError } from './output/cli-error';
import { EXIT, exitCodeForStatus, type ExitCode } from './output/exit-codes';
import { failureOf } from './output/failure-of';
import { render } from './output/print';
import { transport } from './transport';

type Input = Record<string, unknown>;

// The verbs that read no profile, no credential and no api.
function runOffline(io: CliIo, verb: Verb, input: Input): Promise<unknown> | null {
  if (verb.id === 'guide') return Promise.resolve(guideOf(input.topic as string | undefined));
  if (verb.id === 'skill.print') return Promise.resolve({ text: renderSkill() });
  if (verb.id === 'skill.install') return installSkill(io, input.to as string | undefined);
  return null;
}

async function runOnline(io: CliIo, verb: Verb, input: Input, profile: Profile, log: DebugLog) {
  const caps = await loadCapabilities(io, profile, log);
  if (!caps.authEnabled)
    throw new CliError({
      exit: EXIT.auth,
      code: 'auth',
      message: `${profile.host} has no sign-in, so the CLI cannot act there`,
    });
  const http = transport(io, caps.apiBase, log);
  if (verb.id === 'auth.login')
    return login(io, profile, http.forToken, input.withToken as boolean | undefined);
  const credential = await resolveCredential(io, profile.name);
  log(`credential ${credential?.source ?? 'none'}`);
  if (!credential)
    throw new CliError({
      exit: EXIT.auth,
      code: 'auth',
      message: `not signed in to ${profile.host}`,
      hint: 'livediagram auth login --with-token, or set LIVEDIAGRAM_TOKEN',
    });
  // `api` writes unless it only reads.
  const writes =
    verb.id === 'api' ? String(input.method).toUpperCase() !== 'GET' : verb.behaviour !== 'read';
  if (writes && caps.minVersion && isBelow(CLI_VERSION, caps.minVersion)) {
    log(`floor refused ${CLI_VERSION} < ${caps.minVersion}`);
    throw new CliError({
      exit: EXIT.rejected,
      code: 'version',
      message: `${profile.host} accepts writes from livediagram ${caps.minVersion} or later; this is ${CLI_VERSION}`,
      hint: 'npm install -g livediagram@latest, or npx livediagram@latest',
    });
  }
  const api = http.forToken(credential.token);
  if (verb.id === 'auth.status') return status(io, profile, api, credential.source);
  if (verb.id === 'auth.logout') return logout(io, profile, api, credential.source);
  if (verb.id === 'api')
    return callApi(io, api, input as { method: string; path: string; body?: string });
  const ctx: VerbContext = { api, host: profile.host, useShareCode: http.useShareCode, log };
  return verb.run!(ctx, input);
}

// The verb's input from its words; a verb whose input takes `json` asks the api for JSON under --json.
function inputOf(verb: Verb, words: string[], globals: Globals): Input {
  const parsed = parseVerbArgs(verb, words) as Input;
  return globals.mode.json && fieldsOf(verb.input).some((f) => f.key === 'json')
    ? { ...parsed, json: true }
    : parsed;
}

function exitOf(verb: Verb, output: unknown): ExitCode {
  if (verb.id === 'api') {
    const { status } = output as { status: number };
    return status >= 400 ? exitCodeForStatus(status) : EXIT.done;
  }
  return (verb.exitCode?.(output) ?? EXIT.done) as ExitCode;
}

export async function run(argv: readonly string[], io: CliIo): Promise<ExitCode> {
  const log = debugLog(io);
  let host = 'the host';
  let json = false;
  try {
    const { globals, words } = splitGlobals(argv);
    json = globals.mode.json;
    if (globals.version) {
      io.stdout(`${CLI_VERSION}\n`);
      return EXIT.done;
    }
    const routed = route(words);
    if (routed.kind !== 'verb' || globals.help) {
      io.stdout(
        routed.kind === 'top'
          ? topHelp()
          : routed.kind === 'resource'
            ? resourceHelp(routed.resource)
            : verbHelp(routed.verb),
      );
      return EXIT.done;
    }
    const { verb } = routed;
    log(`command ${verb.id}`);
    const input = inputOf(verb, routed.rest, globals);
    let pending = runOffline(io, verb, input);
    if (!pending) {
      const profile = resolveProfile(globals, io, await readConfig(io));
      host = profile.host;
      log(`profile ${profile.name} host ${profile.host} source ${profile.source}`);
      pending = runOnline(io, verb, input, profile, log);
    }
    const value = await pending;
    io.stdout(render(verb, value, globals.mode));
    const code = exitOf(verb, value);
    log(`exit ${code}`);
    return code;
  } catch (err) {
    const failure = failureOf(err, host);
    log(`exit ${failure.exit} ${failure.code}`);
    io.stderr(formatError(failure, json));
    return failure.exit;
  }
}
