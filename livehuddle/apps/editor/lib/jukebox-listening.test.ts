// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JUKEBOX_VOLUME,
  playJukebox,
  resetJukebox,
  setJukeboxArea,
  setJukeboxListening,
  toggleJukeboxListening,
} from './jukebox-listening';

// docs/specs/009-elements/social-pieces.md "Jukebox": off until you press Play, low volume, never before a gesture.
class FakeAudio {
  static made: FakeAudio[] = [];
  src = '';
  paused = true;
  loop = false;
  volume = 1;
  preload = '';
  onerror: (() => void) | null = null;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor() {
    FakeAudio.made.push(this);
  }
}

beforeEach(() => {
  resetJukebox();
  FakeAudio.made = [];
  localStorage.clear();
  vi.stubGlobal('Audio', FakeAudio);
});

describe('the jukebox on this device', () => {
  it('plays nothing until you press Play, even standing in its area', () => {
    setJukeboxArea('jb', 'https://example.com/a.mp3');
    expect(FakeAudio.made[0]?.play ?? vi.fn()).not.toHaveBeenCalled();
  });

  it('plays the area’s source low once you press Play, and stops when you mute or walk out', () => {
    setJukeboxArea('jb', 'https://example.com/a.mp3');
    toggleJukeboxListening();
    const audio = FakeAudio.made[0]!;
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe('https://example.com/a.mp3');
    expect(audio.volume).toBe(JUKEBOX_VOLUME);
    expect(audio.loop).toBe(true);
    expect(localStorage.getItem('livehuddle.jukebox')).toBe('on');
    toggleJukeboxListening();
    expect(audio.pause).toHaveBeenCalled();
    expect(localStorage.getItem('livehuddle.jukebox')).toBe('muted');
    setJukeboxListening('on');
    setJukeboxArea(null, null);
    expect(audio.paused).toBe(true);
  });

  it('keeps one audio element for every jukebox', () => {
    setJukeboxListening('on');
    setJukeboxArea('a', 'https://example.com/a.mp3');
    setJukeboxArea('b', 'https://example.com/b.mp3');
    expect(FakeAudio.made).toHaveLength(1);
    expect(FakeAudio.made[0]!.src).toBe('https://example.com/b.mp3');
  });

  it('stops trying a source that failed', () => {
    setJukeboxListening('on');
    setJukeboxArea('a', 'https://example.com/bad.mp3');
    const audio = FakeAudio.made[0]!;
    audio.onerror?.();
    audio.play.mockClear();
    playJukebox('a', 'https://example.com/bad.mp3');
    expect(audio.play).not.toHaveBeenCalled();
  });
});
