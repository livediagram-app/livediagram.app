// /api/preferences: a person's editor preferences (docs/specs/007-editor/user-preferences.md), kept by liveworkspace
// with the account, or under the guest's id (liveworkspace/settings.ts). @liveworkspace/api-kit's route, where the
// patch and its cap are written, bound to this api's answers.

import { createPreferencesRoute } from '@liveworkspace/api-kit/preferences-route';
import { readPreferences, writePreferences } from '../liveworkspace/settings';
import { badRequest, json, missingAuth, noContent, notFound } from '../responses';

export { PREFERENCES_PATCH_MAX } from '@liveworkspace/api-kit/preferences-route';

export const handlePreferences = createPreferencesRoute({
  readPreferences,
  writePreferences,
  json,
  badRequest,
  missingAuth,
  noContent,
  notFound,
});
