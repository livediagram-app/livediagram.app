import { describe, expect, it } from 'vitest';
import {
  inUseFor,
  isMeetingPieceShape,
  isScreenUrl,
  meetingPieceRoom,
  MEETING_PIECE_REACH_PX,
  roomSignLine,
  roomSignName,
  ROOM_SIGN_ART,
  ROOM_SIGN_TONES,
  screenVideoTarget,
  SCREEN_URL_MAX,
  clampScreenBox,
  screenFile,
  screenFileOfSeed,
  screenSourcePatch,
  withScreenFile,
  SCREEN_MAX,
  SCREEN_MIN,
} from './meeting-pieces';
import { roomZones } from './call-geometry';
import { createShape } from './shape-factory';
import { isFixedSizeElement, isPlacedShape } from './placed-kinds';
import { isBehaviourShape, carriesSharedSettingsMenu } from './behaviour-shapes';
import { shapeValidationIssue } from './validate-shape';
import { svgBehaviourFace } from './svg-render-faces';

const room = (id: string, x: number, y: number, width: number, height: number, shape = 'room') => ({
  id,
  type: 'shape',
  shape,
  x,
  y,
  width,
  height,
});
const piece = (x: number, y: number, width = 20, height = 20) => ({ x, y, width, height });

describe('meetingPieceRoom (screen-and-room-sign.md "A piece\'s room")', () => {
  const zones = roomZones([
    room('big', 0, 0, 480, 320),
    room('pod', 100, 100, 176, 144, 'office-pod'),
  ]);

  it('takes the innermost room the piece stands in', () => {
    expect(meetingPieceRoom(piece(30, 250), zones)).toBe('big');
    expect(meetingPieceRoom(piece(178, 200), zones)).toBe('pod');
  });

  it('takes the nearest room within reach from outside, and none beyond it', () => {
    expect(meetingPieceRoom(piece(200, 330), zones)).toBe('big');
    expect(meetingPieceRoom(piece(200, 320 + MEETING_PIECE_REACH_PX + 20), zones)).toBeNull();
    expect(meetingPieceRoom(piece(0, 0), [])).toBeNull();
  });
});

describe('the Screen', () => {
  it('keeps an http(s) Video Link of bounded length only', () => {
    expect(isScreenUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isScreenUrl('javascript:alert(1)')).toBe(false);
    expect(isScreenUrl(`https://x.test/${'a'.repeat(SCREEN_URL_MAX)}`)).toBe(false);
    expect(isScreenUrl(3)).toBe(false);
  });

  it('plays YouTube, Vimeo and Loom, never a website', () => {
    expect(screenVideoTarget('https://youtu.be/dQw4w9WgXcQ')?.provider).toBe('youtube');
    expect(screenVideoTarget('https://vimeo.com/76979871')?.provider).toBe('vimeo');
    expect(screenVideoTarget('https://example.com/page')).toBeNull();
    expect(screenVideoTarget(undefined)).toBeNull();
  });

  it('is placed at its size, aspect locked, wordless, a Behaviour with no settings dots', () => {
    const s = createShape('screen', 0, 0);
    expect([s.width, s.height, s.aspectLocked, s.label]).toEqual([192, 120, true, '']);
    expect(isPlacedShape('screen') && isPlacedShape('room-sign')).toBe(true);
    expect(isBehaviourShape('screen') && isBehaviourShape('room-sign')).toBe(true);
    expect(carriesSharedSettingsMenu('screen') || carriesSharedSettingsMenu('room-sign')).toBe(
      false,
    );
    expect(isMeetingPieceShape('screen') && !isMeetingPieceShape('room')).toBe(true);
  });

  it('validates screenUrl', () => {
    const s = createShape('screen', 0, 0) as unknown as Record<string, unknown>;
    expect(shapeValidationIssue({ ...s, screenUrl: 'https://youtu.be/x' })).toBeNull();
    expect(shapeValidationIssue({ ...s, screenUrl: 'ftp://x' })?.field).toBe('screenUrl');
  });

  it('exports its idle face, or its video name', () => {
    const s = { ...createShape('screen', 0, 0), id: 's1' };
    expect(svgBehaviourFace(s, '', '#000', '#000')).toContain('No one is sharing');
    const v = { ...s, screenUrl: 'https://vimeo.com/76979871' };
    expect(svgBehaviourFace(v as never, '', '#000', '#000')).toContain('Vimeo');
  });
});

describe('the Room Sign', () => {
  it('says how long in whole minutes and hours', () => {
    expect(inUseFor(30_000)).toBe('Just now');
    expect(inUseFor(5 * 60_000)).toBe('5 min');
    expect(inUseFor(60 * 60_000)).toBe('1 h');
    expect(inUseFor(80 * 60_000)).toBe('1 h 20 min');
    expect(inUseFor(-5)).toBe('Just now');
  });

  it('reads Free, In Use with count and time, or Do Not Disturb', () => {
    expect(roomSignLine('free', 0, 0)).toBe('Free');
    expect(roomSignLine('in-use', 3, 12 * 60_000)).toBe('In Use · 3 · 12 min');
    expect(roomSignLine('dnd', 2, 0)).toBe('Do Not Disturb');
  });

  it('names its room, a pod, or no room', () => {
    expect(roomSignName({ shape: 'room', label: ' Kitchen ' })).toBe('Kitchen');
    expect(roomSignName({ shape: 'room', label: '' })).toBe('Room');
    expect(roomSignName({ shape: 'office-pod' })).toBe('Office Pod');
    expect(roomSignName(null)).toBe('No Room');
  });

  it('exports a Free plaque', () => {
    const s = { ...createShape('room-sign', 0, 0), id: 'r1' };
    const svg = svgBehaviourFace(s, '', '#000', '#000') ?? '';
    expect(svg).toContain('Free');
    // The status lamp and the enamel strip in Free's colour, on the walnut-framed sign.
    expect(svg).toContain(ROOM_SIGN_TONES.free);
    expect(svg).toContain(ROOM_SIGN_ART.tones.frame);
  });
});

// Work Tracker 1427: a Screen any size up to a wall, showing a file, a video or nothing.
describe('a Screen up to wall size', () => {
  it('grows to SCREEN_MAX and shrinks to SCREEN_MIN, keeping its ratio when locked', () => {
    expect(clampScreenBox({ x: 5, width: 3200, height: 2000 }, true)).toEqual({
      x: 5,
      width: SCREEN_MAX.width,
      height: SCREEN_MAX.height,
    });
    expect(clampScreenBox({ width: 48, height: 30 }, true)).toEqual({
      width: SCREEN_MIN.width,
      height: SCREEN_MIN.height,
    });
    const box = { width: 640, height: 400 };
    expect(clampScreenBox(box, true)).toBe(box);
    expect(clampScreenBox({ width: 2000, height: 40 }, false)).toEqual({ width: 1600, height: 60 });
    expect(clampScreenBox({ width: 0, height: 10 }, false)).toEqual({ width: 0, height: 10 });
  });

  it('is resizable, and takes a file within the validation', () => {
    const screen = createShape('screen', 0, 0);
    expect(isFixedSizeElement(screen)).toBe(false);
    const file = { liveItem: { app: 'liveplanner', itemId: 'P1' }, liveName: 'Launch' };
    expect(
      shapeValidationIssue({ ...screen, ...file, liveTab: { id: 't1', name: 'Board' } }),
    ).toBeNull();
    expect(
      shapeValidationIssue({ ...screen, liveItem: { app: 'livehuddle', itemId: 'S1' } }),
    ).not.toBeNull();
    expect(
      shapeValidationIssue({ ...screen, ...file, liveTab: { id: 'a b', name: 'x' } }),
    ).not.toBeNull();
  });
});

describe("a Screen's source", () => {
  const liveItem = { app: 'livedocuments' as const, itemId: 'D1' };

  it('writes one source at a time, clearing the other', () => {
    expect(screenSourcePatch({ kind: 'file', liveItem, liveName: 'Brief' })).toEqual({
      screenUrl: undefined,
      liveItem,
      liveName: 'Brief',
      liveTab: undefined,
    });
    expect(screenSourcePatch({ kind: 'video', url: 'https://youtu.be/x' })).toEqual({
      screenUrl: 'https://youtu.be/x',
      liveItem: undefined,
      liveName: undefined,
      liveTab: undefined,
    });
    expect(Object.values(screenSourcePatch({ kind: 'none' })).every((v) => v === undefined)).toBe(
      true,
    );
  });

  it('reads the file back, with its tab when it has one', () => {
    expect(screenFile({})).toBeNull();
    expect(screenFile({ liveItem })).toEqual({ liveItem, liveName: '' });
    const liveTab = { id: 't2', name: 'Notes' };
    expect(screenFile({ liveItem, liveName: 'Brief', liveTab })).toEqual({
      liveItem,
      liveName: 'Brief',
      liveTab,
    });
  });

  it("seeds a template's Screens with a call's file, leaving a Screen with its own source", () => {
    expect(screenFileOfSeed(undefined)).toBeNull();
    expect(screenFileOfSeed({ app: 'livehuddle', itemId: 'S1', name: 'x' })).toBeNull();
    const seed = screenFileOfSeed({ app: 'livedocuments', itemId: 'D1', name: 'Brief' })!;
    expect(seed).toEqual({ liveItem, liveName: 'Brief' });
    const els = [
      { type: 'shape', shape: 'screen', id: 'a' },
      { type: 'shape', shape: 'screen', id: 'b', screenUrl: 'https://youtu.be/x' },
      { type: 'shape', shape: 'chair', id: 'c' },
    ];
    const seeded = withScreenFile(els, seed);
    expect(seeded[0]).toMatchObject({ liveItem, liveName: 'Brief' });
    expect(seeded[1]).toBe(els[1]);
    expect(seeded[2]).toBe(els[2]);
  });
});
