// The editor's dialog flags (@liveworkspace/workbench/hooks/editor/useEditorDialogs), bound to this editor's
// Knowledgebase Style dialog's views (its home and its Fine-tune panels) and telemetry.
import { createEditorDialogs } from '@liveworkspace/workbench/hooks/editor/useEditorDialogs';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { track } from '@/lib/telemetry';

export const useEditorDialogs = createEditorDialogs<TabStyleView>({ track });
