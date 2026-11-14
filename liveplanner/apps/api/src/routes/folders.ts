// GET /api/folders, POST /api/folders: the caller's own folders for API clients (index-adapters.ts), the list and a
// new one (the CLI's `folder create`), @liveworkspace/index-app's route bound to this api's answers.

import { createFoldersRoute } from '@liveworkspace/index-app';
import { json, notFound } from '../responses';
import { requireOwner } from './context';
import { clientFor, folderOf } from './index-adapters';

export const handleFolders = createFoldersRoute({
  json,
  notFound,
  requireOwner,
  clientFor,
  folderOf,
});
