import { PixelCharacter } from '../illustrations/pixel-character';

// The shirts a pixel character comes in, picked by the nearest colour of the class a scene passes.
const SHIRTS = ['brand', 'emerald', 'violet', 'rose'] as const;

// A character as Avatar mode draws one, the editor's pixel character at a card's size, its head about (x, y).
// Shared by the About and Getting Started scenes.
export function Character({ x, y, shirt }: { x: number; y: number; shirt: string }) {
  const tone = SHIRTS.find((s) => shirt.includes(s)) ?? 'emerald';
  return <PixelCharacter fx={x} fy={y + 16} px={1.1} shirt={tone} />;
}
