'use client';

// Which optional server features are available (@liveworkspace/workbench/hooks/persistence/useCapabilities), from
// this editor's api.
import { createCapabilities } from '@liveworkspace/workbench/hooks/persistence/useCapabilities';
import { apiGetCapabilities } from '@/lib/api-client';

export const useCapabilities = createCapabilities(() => apiGetCapabilities());
