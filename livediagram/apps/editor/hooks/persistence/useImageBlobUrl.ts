'use client';

// An image's authenticated bytes as a blob URL (@liveworkspace/workbench/hooks/persistence/useImageBlobUrl), through
// this editor's api client.
import { createImageBlobUrl } from '@liveworkspace/workbench/hooks/persistence/useImageBlobUrl';
import { apiFetchImageBlobUrl, releaseImageBlobUrl } from '@/lib/api-client';

export const useImageBlobUrl = createImageBlobUrl({ apiFetchImageBlobUrl, releaseImageBlobUrl });
