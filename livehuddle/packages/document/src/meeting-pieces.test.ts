import { describe, expect, it } from 'vitest';
import {
  inUseFor,
  isMeetingPieceShape,
  isScreenUrl,
  meetingPieceRoom,
  MEETING_PIECE_REACH_PX,
  roomSignLine,
  roomSignName,
  screenVideoTarget,
  SCREEN_URL_MAX,
} from './meeting-pieces';
import { roomZones } from './call-geometry';
import { createShape } from './shape-factory';
import { isPlacedShape } from './placed-kinds';
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
    expect(svg).toContain('#22c55e');
  });
});
