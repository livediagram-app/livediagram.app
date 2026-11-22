import { createAnimationPreviewTile } from '@liveworkspace/workbench/components/palette/AnimationPreviewTile';
import { SizeButton } from '@/components/palette/palette-controls';

// One animation option in a menu: a frozen miniature that plays while hovered, shared by the editors and drawn in
// this one's palette tile.
export const AnimationPreviewTile = createAnimationPreviewTile({ SizeButton });
