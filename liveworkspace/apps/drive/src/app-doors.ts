// Each app's two Drive doors (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"), at
// `<APP_ORIGIN_<APP>>/api/internal/items/…` with the app's DRIVE_KEY: the item's whole-item envelope (and its
// drawing, for the thumbnail) out, and a new item from a file in. And where an item opens in its app. The calls
// themselves are the platform's one client of the apps' doors (@liveworkspace/app-doors); this binds the mirror's
// origins and keys, and keeps to the calls the Drive key opens.

import { createAppDoors as createDoors, type AppDoors as AllDoors } from '@liveworkspace/app-doors';
import { appKey, appOrigin, type Env } from './env';

export { DoorError, DOOR_TIMEOUT_MS, type ImportAnswer } from '@liveworkspace/app-doors';

export type AppDoors = Pick<AllDoors, 'exportFile' | 'exportSvg' | 'importFile' | 'itemUrl'>;

export function createAppDoors(
  env: Env,
  doFetch: typeof fetch = (i, init) => fetch(i, init),
): AppDoors {
  const doors = createDoors(
    { origin: (app) => appOrigin(env, app), key: (app) => appKey(env, app), caller: 'drive' },
    doFetch,
  );
  return {
    exportFile: (app, itemId) => doors.exportFile(app, itemId),
    exportSvg: (app, itemId) => doors.exportSvg(app, itemId),
    importFile: (app, input) => doors.importFile(app, input),
    itemUrl: (app, itemId) => doors.itemUrl(app, itemId),
  };
}
