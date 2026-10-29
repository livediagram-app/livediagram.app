// The browser's routes (liveworkspace/docs/specs/005-drive/drive.md "The service"), under /api/drive on liveworkspace's origin and
// on each app's through its router. Every route but `config` needs a configured deployment (503 otherwise) and an
// account access token (401 otherwise); each answers from the person's object, by account id.

import { storageOutageOf } from '@liveworkspace/api-kit/request-failure';
import {
  isDriveId,
  type DriveConfigAnswer,
  type DriveConnectAnswer,
  type DriveConnectionAnswer,
  type DriveErrorCode,
  type DriveImportAnswer,
  type DriveMarksAnswer,
  type DriveOpenAnswer,
  type DrivePickerTokenAnswer,
  type DriveStateAnswer,
} from '@liveworkspace/drive';
import { signDriveState, verifyDriveState } from '@liveworkspace/drive/server';
import { accountOf } from './auth';
import { consentUrl, redirectUriOf, safeReturnTo } from './consent';
import { driveConfigured, setting, type Env } from './env';
import { fail, json, noContent, notFound, readObject } from './http';
import type { IndexApi } from './index-api';
import { driveLog, driveWarn, errorKind } from './log';
import type { OpenTarget } from './open';

type Refusal = { refused: DriveErrorCode };

/** The person's object as the routes call it: the Durable Object's RPC surface (durable-object.ts). */
export interface MirrorApi {
  isConnected(personId: string): Promise<boolean>;
  connectGoogle(
    personId: string,
    code: string,
    redirectUri: string,
  ): Promise<
    | { outcome: 'connected' | 'no_refresh_token' | 'google_failed' }
    | { outcome: 'switch_pending'; until: number }
  >;
  connection(personId: string): Promise<DriveConnectionAnswer>;
  confirmSwitch(personId: string): Promise<boolean>;
  cancelSwitch(personId: string): Promise<boolean>;
  disconnect(personId: string): Promise<boolean>;
  signal(personId: string): Promise<void>;
  check(personId: string): Promise<DriveConnectionAnswer | Refusal>;
  marks(personId: string): Promise<DriveMarksAnswer>;
  pickerToken(personId: string): Promise<DrivePickerTokenAnswer | Refusal>;
  adopt(personId: string, folderId: string, itemId: string | null): Promise<{ ok: true } | Refusal>;
  open(personId: string, target: OpenTarget): Promise<DriveOpenAnswer>;
  importFile(personId: string, target: OpenTarget): Promise<DriveImportAnswer | Refusal>;
}

export type RouteDeps = {
  mirrors: (personId: string) => MirrorApi;
  index: IndexApi;
  now: () => number;
  waitUntil: (promise: Promise<unknown>) => void;
};

const refused = (answer: object): answer is Refusal => 'refused' in answer;

// Open and import reach Google, the index and an app's door: a failure none of them names (a Google 5xx once the
// client stops retrying, a token endpoint outage, an index error, a door timeout) is `502 google_failed`, never a 500.
// The person's own mirror out of reach is no upstream's failure: it goes on to the request-failure guard, a 503.
function unexpected(route: string, err: unknown, person: string): Response {
  if (storageOutageOf(err)) throw err;
  driveWarn(`${route}-failed`, { person, error: errorKind(err) });
  return fail('google_failed');
}

function logRoute(route: string, outcome: string, person?: string): void {
  driveLog(`route ${route}`, { outcome, ...(person ? { person } : {}) });
}

// GET /api/drive/config: what the UI shows. Cheap: the index's flag says whether the person is connected (one indexed
// read, where asking the object would wake one per signed-in page view), and a person with no token, or a guest, is
// simply not connected. Only when the index can't answer is the object asked.
async function config(request: Request, env: Env, deps: RouteDeps): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!driveConfigured(env)) {
    const off: DriveConfigAnswer = {
      enabled: false,
      connected: false,
      clientId: null,
      pickerKey: null,
      appId: null,
    };
    return json(off, { headers });
  }
  const person = await accountOf(request, env);
  let connected = false;
  if (person)
    connected =
      (await deps.index.isMirrored(person)) ?? (await deps.mirrors(person).isConnected(person));
  const answer: DriveConfigAnswer = {
    enabled: true,
    connected,
    clientId: setting(env.GOOGLE_CLIENT_ID) ?? null,
    pickerKey: setting(env.GOOGLE_PICKER_KEY) ?? null,
    appId: setting(env.GOOGLE_APP_ID) ?? null,
  };
  return json(answer, { headers });
}

const fileTarget = (body: Record<string, unknown> | null): OpenTarget | null => {
  if (!body || !isDriveId(body.fileId)) return null;
  const key = body.resourceKey;
  if (key !== undefined && key !== null && !isDriveId(key)) return null;
  return typeof key === 'string'
    ? { fileId: body.fileId, resourceKey: key }
    : { fileId: body.fileId };
};

type Handler = (ctx: {
  request: Request;
  env: Env;
  deps: RouteDeps;
  person: string;
  mirror: MirrorApi;
}) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  connection: {
    GET: async ({ person, mirror }) => json(await mirror.connection(person)),
    DELETE: async ({ person, mirror }) => {
      const had = await mirror.disconnect(person);
      logRoute('disconnect', had ? 'done' : 'none', person);
      return noContent();
    },
  },

  state: {
    POST: async ({ request, env, deps, person }) => {
      const body = await readObject(request);
      if (!body) return fail('invalid_request');
      const redirectUri = redirectUriOf(env);
      const returnTo = safeReturnTo(env, body.returnTo);
      const state = await signDriveState(
        env.DRIVE_TOKEN_KEY!,
        { sub: person, redirectUri, returnTo },
        deps.now(),
      );
      const answer: DriveStateAnswer = {
        state,
        redirectUri,
        authUrl: consentUrl(setting(env.GOOGLE_CLIENT_ID)!, redirectUri, state),
      };
      logRoute('state', 'ok', person);
      return json(answer);
    },
  },

  connect: {
    POST: async ({ request, env, deps, person, mirror }) => {
      const body = await readObject(request);
      const code = body?.code;
      const stateValue = body?.state;
      if (typeof code !== 'string' || !code || typeof stateValue !== 'string' || !stateValue) {
        return fail('invalid_request');
      }
      const state = await verifyDriveState(env.DRIVE_TOKEN_KEY!, stateValue, person, deps.now());
      if (!state) {
        logRoute('connect', 'invalid_state', person);
        return fail('invalid_state');
      }
      const result = await mirror.connectGoogle(person, code, state.redirectUri);
      logRoute('connect', result.outcome, person);
      if (result.outcome === 'google_failed') return fail('google_failed');
      const answer: DriveConnectAnswer =
        result.outcome === 'switch_pending'
          ? { outcome: 'switch_pending', returnTo: state.returnTo, until: result.until }
          : { outcome: result.outcome, returnTo: state.returnTo };
      return json(answer);
    },
  },

  'account-switch': {
    POST: async ({ person, mirror }) => {
      const confirmed = await mirror.confirmSwitch(person);
      logRoute('account-switch', confirmed ? 'confirmed' : 'none', person);
      return confirmed ? json(await mirror.connection(person)) : notFound();
    },
    DELETE: async ({ person, mirror }) => {
      logRoute(
        'account-switch',
        (await mirror.cancelSwitch(person)) ? 'cancelled' : 'none',
        person,
      );
      return noContent();
    },
  },

  check: {
    POST: async ({ person, mirror }) => {
      const answer = await mirror.check(person);
      return refused(answer) ? fail(answer.refused) : json(answer);
    },
  },

  marks: {
    GET: async ({ person, mirror }) => json(await mirror.marks(person)),
  },

  'picker-token': {
    POST: async ({ person, mirror }) => {
      const answer = await mirror.pickerToken(person);
      logRoute('picker-token', refused(answer) ? answer.refused : 'ok', person);
      return refused(answer) ? fail(answer.refused) : json(answer);
    },
  },

  adopt: {
    POST: async ({ request, person, mirror }) => {
      const body = await readObject(request);
      const itemId = body?.itemId ?? null;
      if (!body || !isDriveId(body.folderId) || (itemId !== null && !isDriveId(itemId))) {
        return fail('invalid_request');
      }
      const answer = await mirror.adopt(person, body.folderId, itemId);
      logRoute('adopt', refused(answer) ? answer.refused : 'ok', person);
      return refused(answer) ? fail(answer.refused) : noContent();
    },
  },

  open: {
    POST: async ({ request, person, mirror }) => {
      const target = fileTarget(await readObject(request));
      if (!target) return fail('invalid_request');
      try {
        const answer = await mirror.open(person, target);
        logRoute('open', answer.action, person);
        return json(answer);
      } catch (err) {
        return unexpected('open', err, person);
      }
    },
  },

  import: {
    POST: async ({ request, person, mirror }) => {
      const target = fileTarget(await readObject(request));
      if (!target) return fail('invalid_request');
      try {
        const answer = await mirror.importFile(person, target);
        logRoute('import', refused(answer) ? answer.refused : 'ok', person);
        return refused(answer) ? fail(answer.refused) : json(answer);
      } catch (err) {
        return unexpected('import', err, person);
      }
    },
  },
};

/** `/api/drive/<route>` but push (app-routes.ts), which carries no person's token. */
export async function handleBrowser(
  request: Request,
  env: Env,
  route: string,
  deps: RouteDeps,
): Promise<Response> {
  if (route === 'config') return request.method === 'GET' ? config(request, env, deps) : notFound();
  const handler = Object.hasOwn(ROUTES, route) ? ROUTES[route]?.[request.method] : undefined;
  if (!handler) return notFound();
  if (!driveConfigured(env)) return fail('drive_not_configured');
  // A signed-in person only: a guest token, an API token or none is refused.
  const person = await accountOf(request, env);
  if (!person) {
    logRoute(route, 'unauthorised');
    return fail('unauthorised');
  }
  return handler({ request, env, deps, person, mirror: deps.mirrors(person) });
}
