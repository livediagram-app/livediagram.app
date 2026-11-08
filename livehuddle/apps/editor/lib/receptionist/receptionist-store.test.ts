// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  askReceptionist,
  closeReceptionist,
  getReceptionistState,
  noteReceptionistGreetedYou,
  openReceptionist,
  resetReceptionistState,
  sayReceptionistFarewell,
  setReceptionistHere,
  setReceptionistPerson,
  showReceptionistTopic,
  useReceptionistState,
} from './receptionist-store';

// docs/specs/008-canvas/receptionist.md "The welcome" and "Asking the Receptionist".

afterEach(() => resetReceptionistState());

describe('The Receptionist store', () => {
  it('asks: counts each ask and opens the list', () => {
    askReceptionist();
    expect(getReceptionistState()).toMatchObject({
      asks: 1,
      chat: { open: true, reason: 'ask', topicId: null },
    });
    askReceptionist('welcome');
    expect(getReceptionistState()).toMatchObject({ asks: 2, chat: { reason: 'welcome' } });
  });

  it('opens where he stands, shows a topic or every topic, and closes', () => {
    showReceptionistTopic('rooms');
    expect(getReceptionistState().chat.open).toBe(false);
    openReceptionist('back');
    expect(getReceptionistState().asks).toBe(0);
    showReceptionistTopic('rooms');
    expect(getReceptionistState().chat).toEqual({
      open: true,
      reason: 'back',
      topicId: 'rooms',
    });
    showReceptionistTopic(null);
    expect(getReceptionistState().chat).toMatchObject({ topicId: null });
    sayReceptionistFarewell();
    expect(getReceptionistState().chat).toEqual({ open: true, reason: 'farewell', topicId: null });
    const before = getReceptionistState();
    closeReceptionist();
    expect(getReceptionistState().chat).toEqual({ open: false });
    const closed = getReceptionistState();
    closeReceptionist();
    expect(getReceptionistState()).toBe(closed);
    expect(before).not.toBe(closed);
  });

  it('counts greetings, notes whether he is here, and keeps the person until it changes', () => {
    noteReceptionistGreetedYou();
    noteReceptionistGreetedYou();
    expect(getReceptionistState().greets).toBe(2);
    setReceptionistHere(true);
    const here = getReceptionistState();
    setReceptionistHere(true);
    expect(getReceptionistState()).toBe(here);
    setReceptionistPerson({ speak: true, edit: false }, ['rooms']);
    const person = getReceptionistState();
    expect(person).toMatchObject({ can: { speak: true, edit: false }, heard: ['rooms'] });
    setReceptionistPerson({ speak: true, edit: false }, ['rooms']);
    expect(getReceptionistState()).toBe(person);
    setReceptionistPerson({ speak: true, edit: false }, ['look']);
    expect(getReceptionistState().heard).toEqual(['look']);
    setReceptionistPerson({ speak: true, edit: true }, ['look']);
    expect(getReceptionistState().can.edit).toBe(true);
    setReceptionistPerson({ speak: true, edit: true }, ['look'], 'Sam');
    expect(getReceptionistState().name).toBe('Sam');
  });

  it('re-renders a reader on every change', () => {
    const { result } = renderHook(() => useReceptionistState());
    expect(result.current.chat.open).toBe(false);
    act(() => askReceptionist());
    expect(result.current.chat.open).toBe(true);
    act(() => resetReceptionistState());
    expect(result.current.asks).toBe(0);
  });
});
