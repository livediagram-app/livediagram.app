'use client';

import { createEditorContext } from '@liveworkspace/workbench/hooks/editor/createEditorContext';
import type { useEditorState } from './useEditorState';

// Typed from the page's orchestration hook, so the value type stays in lockstep with the provider + consumers.
export const { EditorContext, useEditorContext, useOptionalEditorContext } =
  createEditorContext<ReturnType<typeof useEditorState>>();
