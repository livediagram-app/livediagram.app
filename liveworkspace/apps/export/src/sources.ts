// Where an export reads from (liveworkspace/docs/specs/003-accounts/data-export.md "Contracts"): the index, as the
// person or the team (INDEX_KEY_EXPORT, X-Index-App: export), the media service (MEDIA_KEY_EXPORT, X-Media-App:
// export), the apps' export doors (@liveworkspace/app-doors, with DATA_EXPORT_KEY_<APP>), and accounts, told when an
// export finishes. Each through its service binding; a request is counted against the chunk's budget before it goes.

import { createAppDoors, type AppDoors } from '@liveworkspace/app-doors';
import {
  DATA_EXPORT_READY_PATH,
  type ExportReadyCall,
  type ExportScope,
} from '@liveworkspace/data-export';
import {
  INDEX_API_PATH,
  INDEX_APP_HEADER,
  INDEX_PERSON_HEADER,
  INDEX_TEAMS_HEADER,
  isApp,
  LIST_LIMIT_MAX,
  type App,
} from '@liveworkspace/index-client';
import { MEDIA_APP_HEADER, type MediaImage } from '@liveworkspace/media';
import { appKey, appOrigin, setting, type Env } from './env';

/** An item as the export lists it. */
export type ListedItem = { id: string; app: App; name: string; updatedAt: number };

export interface Sources {
  /** One page of the scope's items, and the cursor for the next (null: the last page). */
  listItems(
    scope: ExportScope,
    requestedBy: string,
    cursor: string | null,
  ): Promise<{ items: ListedItem[]; nextCursor: string | null }>;
  listImages(personId: string): Promise<MediaImage[]>;
  /** An image's bytes, or null when it is gone. */
  imageBytes(id: string): Promise<Uint8Array | null>;
  doors: Pick<AppDoors, 'exportFile' | 'exportSvg' | 'exportTables' | 'exportComments'>;
  ready(call: ExportReadyCall): Promise<void>;
}

/** What the export delegate names itself to the index and the media service. */
export const EXPORT_DELEGATE = 'export';

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}

type Bound = (path: string, init?: RequestInit) => Promise<Response>;

// A service binding never looks the host up; the path is what the Worker routes on.
function bound(binding: Fetcher | undefined, host: string, count: () => void): Bound {
  return (path, init) => {
    if (!binding) throw new SourceError(`export: no ${host} binding`);
    count();
    return binding.fetch(`https://${host}${path}`, init);
  };
}

export function createSources(env: Env, count: () => void = () => {}): Sources {
  const index = bound(env.INDEX, 'index', count);
  const media = bound(env.MEDIA, 'media', count);
  const accounts = bound(env.ACCOUNTS, 'accounts', count);
  const doors = createAppDoors(
    { origin: (app) => appOrigin(env, app), key: (app) => appKey(env, app), caller: 'export' },
    (input, init) => (count(), fetch(input, init)),
  );
  const mediaHeaders = () => ({
    Authorization: `Bearer ${setting(env.MEDIA_KEY_EXPORT) ?? ''}`,
    [MEDIA_APP_HEADER]: EXPORT_DELEGATE,
  });

  return {
    async listItems(scope, requestedBy, cursor) {
      const query = new URLSearchParams({ limit: String(LIST_LIMIT_MAX) });
      if (cursor) query.set('cursor', cursor);
      const res = await index(`${INDEX_API_PATH}/items?${query}`, {
        headers: {
          Authorization: `Bearer ${setting(env.INDEX_KEY_EXPORT) ?? ''}`,
          [INDEX_APP_HEADER]: EXPORT_DELEGATE,
          [INDEX_PERSON_HEADER]: scope.kind === 'personal' ? scope.personId : requestedBy,
          ...(scope.kind === 'team' ? { [INDEX_TEAMS_HEADER]: scope.teamId } : {}),
        },
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new SourceError(`export: index list ${res.status}`);
      }
      const body = (await res.json()) as {
        items?: { id?: unknown; app?: unknown; title?: unknown; updatedAt?: unknown }[];
        nextCursor?: unknown;
      };
      const items = (body.items ?? []).flatMap((item) =>
        typeof item.id === 'string' && isApp(item.app)
          ? [
              {
                id: item.id,
                app: item.app,
                name: typeof item.title === 'string' ? item.title : '',
                updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
              },
            ]
          : [],
      );
      return { items, nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null };
    },

    async listImages(personId) {
      const res = await media(`/api/media/app/images?owner=${encodeURIComponent(personId)}`, {
        headers: mediaHeaders(),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new SourceError(`export: media list ${res.status}`);
      }
      const body = (await res.json()) as { images?: MediaImage[] };
      return Array.isArray(body.images) ? body.images : [];
    },

    async imageBytes(id) {
      const res = await media(`/api/media/app/images/${encodeURIComponent(id)}/bytes`, {
        headers: mediaHeaders(),
      });
      if (res.status === 404) {
        await res.body?.cancel();
        return null;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new SourceError(`export: media bytes ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },

    doors,

    async ready(call) {
      const res = await accounts(DATA_EXPORT_READY_PATH, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${setting(env.EXPORT_KEY_ACCOUNTS) ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(call),
      });
      await res.body?.cancel();
      if (!res.ok) throw new SourceError(`export: accounts ready ${res.status}`);
    },
  };
}
