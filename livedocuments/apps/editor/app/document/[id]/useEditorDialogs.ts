// The editor's dialog flags (@liveworkspace/workbench/hooks/editor/useEditorDialogs), bound to this editor's
// Canvas/Theme dialog tabs and telemetry.
import { createEditorDialogs } from '@liveworkspace/workbench/hooks/editor/useEditorDialogs';
import type { CanvasThemeTab } from '@/components/dialogs/CanvasThemeDialog';
import { track } from '@/lib/telemetry';

export const useEditorDialogs = createEditorDialogs<CanvasThemeTab>({ track });
