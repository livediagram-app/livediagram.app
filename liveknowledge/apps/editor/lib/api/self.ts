// Participant / account calls: load self, save self, account self-deletion
// (@liveworkspace/workbench/lib/api/self), bound to this editor's api core.
import { createSelfApi } from '@liveworkspace/workbench/lib/api/self';
import type { Participant } from '../identity';
import { API_BASE, apiFetch, apiHeaders, expectOkOrNull, expectOkVoid } from './core';

export const { apiLoadSelf, apiSendDeletionCode, apiDeleteAccount, apiSaveSelf } =
  createSelfApi<Participant>({
    get apiBase() {
      return API_BASE;
    },
    apiFetch,
    apiHeaders,
    expectOkOrNull,
    expectOkVoid,
  });
