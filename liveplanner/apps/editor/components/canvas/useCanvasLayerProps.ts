// The Layers panel's props for the Canvas (docs/specs/006-project/layers.md): the tab's layers, the active one,
// their counts and preview, and every layer action, read from EditorContext. Split from EditorCanvasHost, which
// spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/project/[id]/EditorContext';

export function useCanvasLayerProps(): Pick<
  CanvasProps,
  | 'onSelectLayer'
  | 'onAddLayer'
  | 'onRemoveLayer'
  | 'onRenameLayer'
  | 'onToggleLayerVisibility'
  | 'onToggleLayerLock'
  | 'onReorderLayer'
  | 'onMergeLayer'
  | 'onSetLayerOpacity'
  | 'onClearLayer'
  | 'onHideOtherLayers'
  | 'layerPreviewId'
  | 'onPreviewLayer'
  | 'layers'
  | 'activeLayerId'
  | 'layerCounts'
  | 'tabLayers'
  | 'layerInertIds'
> {
  const {
    activeTab,
    layers,
    activeLayerId,
    layerInertIds,
    layerCounts,
    setActiveLayer,
    addLayer,
    renameLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    mergeActiveLayer,
    setLayerOpacityLive,
    clearLayer,
    hideOtherLayersOp,
    layerPreviewId,
    setLayerPreviewId,
  } = useEditorContext();
  return {
    onSelectLayer: setActiveLayer,
    onAddLayer: addLayer,
    onRemoveLayer: removeLayer,
    onRenameLayer: renameLayer,
    onToggleLayerVisibility: toggleLayerVisibility,
    onToggleLayerLock: toggleLayerLock,
    onReorderLayer: reorderLayer,
    onMergeLayer: mergeActiveLayer,
    onSetLayerOpacity: setLayerOpacityLive,
    onClearLayer: clearLayer,
    onHideOtherLayers: hideOtherLayersOp,
    layerPreviewId,
    onPreviewLayer: setLayerPreviewId,
    layers,
    activeLayerId,
    layerCounts,
    tabLayers: activeTab.layers,
    layerInertIds,
  };
}
