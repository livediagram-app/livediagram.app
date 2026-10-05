// One command, start to end (docs/specs/015-api/blueprints/cli.md "One command"): global flags, routing, help,
// the verb's input, the profile and credential, the host's capabilities, the handler, and what it prints. The
// exit code is one of eight; stdout carries data only.

import { graphLint, renderSkill, type Verb, type VerbContext } from '@livediagram/agent-verbs';
import { resolveCredential } from './auth/credentials';
import { callApi, guideOf, installSkill, login, logout, status } from './commands/local';
import { loadCapabilities } from './config/capabilities';
import { withTelemetry, type ConfigFile } from './config/config-file';
import { configDir } from './config/paths';
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
import { inputReader } from './input';
import { fileReadCopies } from './sync/read-copies';
import { reportApiFailure, sendCliUsed, setTelemetry, type TelemetrySink } from './telemetry';
import { transport } from './transport';

type Input = Record<string, unknown>;

// The verbs that read no profile, no credential and no api.
function runOffline(io: CliIo, verb: Verb, input: Input): Promise<unknown> | null {
  if (verb.id === 'guide') return Promise.resolve(guideOf(input.topic as string | undefined));
  if (verb.id === 'skill.print') return Promise.resolve({ text: renderSkill() });
  if (verb.id === 'skill.install') return installSkill(io, input.to as string | undefined);
  if (verb.id === 'graph.lint') {
    const file = input.file as string;
    return inputReader(io)(file).then((text) =>
      graphLint(text, file === '-' ? 'stdin' : file, input.compare as string | undefined),
    );
  }
  return null;
}

// What a command reported to once it knew the host: the telemetry sink and the config that may turn it off.
type Reporting = { sink: TelemetrySink; config: ConfigFile; host: string };

async function writeTelemetrySetting(io: CliIo, on: boolean): Promise<void> {
  const path = `${configDir(io)}/config.toml`;
  await io.files.mkdir(configDir(io), 0o700);
  await io.files.write(path, withTelemetry((await io.files.read(path)) ?? '', on));
}

async function runOnline(
  io: CliIo,
  verb: Verb,
  input: Input,
  profile: Profile,
  log: DebugLog,
  reporting: (sink: TelemetrySink) => void,
) {
  const caps = await loadCapabilities(io, profile, log);
  const sink: TelemetrySink = { io, apiBase: caps.apiBase, log };
  reporting(sink);
  if (verb.id === 'telemetry.on' || verb.id === 'telemetry.off') {
    const on = verb.id === 'telemetry.on';
    return setTelemetry(on, sink, () => writeTelemetrySetting(io, on));
  }
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
  const ctx: VerbContext = {
    api,
    host: profile.host,
    useShareCode: http.useShareCode,
    log,
    notice: (line) => io.stderr(`${line}\n`),
    now: io.now,
    newId: () => crypto.randomUUID(),
    sleep: io.sleep,
    readInput: inputReader(io),
    copies: fileReadCopies(io, profile.name, log),
  };
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
  // Set once the host is known, from inside runOnline.
  const reported: { current: Reporting | null } = { current: null };
  let verbId: string | null = null;
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
    verbId = verb.id;
    log(`command ${verb.id}`);
    const input = inputOf(verb, routed.rest, globals);
    let pending = runOffline(io, verb, input);
    if (!pending) {
      const config = await readConfig(io);
      const profile = resolveProfile(globals, io, config);
      host = profile.host;
      log(`profile ${profile.name} host ${profile.host} source ${profile.source}`);
      pending = runOnline(io, verb, input, profile, log, (sink) => {
        reported.current = { sink, config, host: profile.host };
      });
    }
    const value = await pending;
    io.stdout(render(verb, value, globals.mode));
    const code = exitOf(verb, value);
    log(`exit ${code}`);
    const reporting = reported.current;
    if (code === EXIT.done && reporting && !verb.id.startsWith('telemetry.'))
      await sendCliUsed(verb.id, reporting.sink, reporting.config, reporting.host);
    return code;
  } catch (err) {
    const reporting = reported.current;
    if (reporting && verbId) await reportApiFailure(err, verbId, reporting.sink, reporting.config);
    const failure = failureOf(err, host);
    log(`exit ${failure.exit} ${failure.code}`);
    io.stderr(formatError(failure, json));
    return failure.exit;
  }
}
