'use client';

// Which optional server features are available (@liveworkspace/workbench/hooks/persistence/useCapabilities), from
// this editor's api, with liveplanner's own `githubEnabled`: the deployment has the GitHub App
// (docs/specs/026-plan/github-pull-requests.md "The App"), which the Automations screen reads from the same one
// read, never the board.
import { createCapabilities } from '@liveworkspace/workbench/hooks/persistence/useCapabilities';
import { apiGetCapabilities } from '@/lib/api-client';

export const useCapabilities = createCapabilities(() => apiGetCapabilities(), ['githubEnabled']);
