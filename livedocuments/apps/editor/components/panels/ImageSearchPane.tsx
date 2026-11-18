'use client';

// The image picker's Search tab (docs/specs/009-elements/image-search.md "The Search tab"): the workbench's pane
// (@liveworkspace/workbench/components/image-search/ImageSearchPane), bound once to this editor's search hook.
import { createImageSearchPane } from '@liveworkspace/workbench/components/image-search/ImageSearchPane';
import { useImageSearch } from '@/hooks/ui/useImageSearch';

export const ImageSearchPane = createImageSearchPane(useImageSearch);
