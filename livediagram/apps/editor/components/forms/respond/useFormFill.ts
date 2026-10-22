'use client';

// Filling in a form (docs/specs/030-forms/forms.md "Filling in a form"): the answers, one section at a time, each
// field checked when it loses focus and again on Next or Submit, answers kept in session storage while filling in.
// Next and Back step over a section the answers so far do not show ("Showing a section only sometimes"), and the
// progress counts only the sections that show.
// Shared by the form link's page and the builder's Preview, which differ only in what Submit does.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkAnswer,
  checkResponse,
  sectionsShown,
  withLocaleNumbers,
  type AnswerError,
  type PublicForm,
} from '@livediagram/forms';

export type FillState = { answers: Record<string, unknown>; other: Record<string, string> };

export type SubmitOutcome =
  | { kind: 'sent' }
  | { kind: 'invalid'; errors: Record<string, AnswerError> }
  | { kind: 'closed' }
  | { kind: 'failed'; message: string };

const EMPTY: FillState = { answers: {}, other: {} };

function readDraft(key: string | null): FillState {
  if (!key) return EMPTY;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as FillState;
    return parsed && typeof parsed === 'object' && parsed.answers ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeDraft(key: string | null, state: FillState | null) {
  if (!key) return;
  try {
    if (state) sessionStorage.setItem(key, JSON.stringify(state));
    else sessionStorage.removeItem(key);
  } catch {
    // Private windows and blocked storage: the answers just are not kept across a reload.
  }
}

export function useFormFill(
  form: PublicForm,
  submit: (state: FillState) => Promise<SubmitOutcome>,
  draftKey: string | null,
) {
  const [state, setStateRaw] = useState<FillState>(() => readDraft(draftKey));
  // The answers as last set, read by the handlers below (events arrive one at a time).
  const stateRef = useRef(state);
  const setState = useCallback((next: FillState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);
  const [section, setSection] = useState(0);
  const [errors, setErrors] = useState<Record<string, AnswerError>>({});
  // The questions an error summary is showing for (set on Next or Submit; cleared as they are fixed).
  const [summary, setSummary] = useState<string[]>([]);
  const [status, setStatus] = useState<'filling' | 'sending' | 'sent' | 'closed'>('filling');
  const [failure, setFailure] = useState<string | null>(null);
  // Set the moment Submit is pressed: a second press before the button disables sends nothing more.
  const sendingRef = useRef(false);
  // The sections these answers show, by index; the first always does.
  const order = useMemo(() => {
    const shown = sectionsShown(form, state.answers);
    return form.sections.flatMap((_, i) => (shown[i] ? [i] : []));
  }, [form, state.answers]);
  const last = order[order.length - 1]!;
  const at = Math.min(section, form.sections.length - 1);
  const current = form.sections[at]!;
  const byId = useMemo(
    () => new Map(form.sections.flatMap((s) => s.questions.map((q) => [q.id, q] as const))),
    [form],
  );
  // Number answers as the respondent's locale writes them (`3,5` in German), read before every check and the send
  // (@livediagram/forms locale-number.ts); the field keeps showing what was typed.
  const read = useCallback(
    (s: FillState): FillState => {
      const locale = typeof navigator === 'undefined' ? 'en-GB' : navigator.language || 'en-GB';
      const answers = withLocaleNumbers(byId.values(), s.answers, locale);
      return answers === s.answers ? s : { ...s, answers };
    },
    [byId],
  );

  useEffect(() => {
    if (status === 'filling') writeDraft(draftKey, state);
  }, [draftKey, state, status]);

  const recheck = useCallback(
    (id: string, next: FillState) => {
      const q = byId.get(id);
      if (!q) return;
      setErrors((prev) => {
        if (!(id in prev)) return prev;
        const r = checkAnswer(q, read(next).answers[id], next.other[id]);
        const copy = { ...prev };
        if (r.error) copy[id] = r.error;
        else delete copy[id];
        return copy;
      });
    },
    [byId, read],
  );

  const setAnswer = useCallback(
    (id: string, value: unknown) => {
      const prev = stateRef.current;
      const next = { ...prev, answers: { ...prev.answers, [id]: value } };
      setState(next);
      recheck(id, next);
    },
    [recheck, setState],
  );
  const setOther = useCallback(
    (id: string, text: string) => {
      const prev = stateRef.current;
      const next = { ...prev, other: { ...prev.other, [id]: text } };
      setState(next);
      recheck(id, next);
    },
    [recheck, setState],
  );

  // A field left: checked now, so a mistake shows before Next.
  const blur = useCallback(
    (id: string) => {
      const q = byId.get(id);
      if (!q) return;
      const prev = stateRef.current;
      const r = checkAnswer(q, read(prev).answers[id], prev.other[id]);
      // An empty field left alone is not an error until Next: a respondent tabbing through is not wrong yet.
      const empty = r.error === 'required' || r.error === 'must_tick';
      setErrors((e) => {
        if (r.error && !empty) return { ...e, [id]: r.error };
        if (!r.error && id in e) {
          const copy = { ...e };
          delete copy[id];
          return copy;
        }
        return e;
      });
    },
    [byId, read],
  );

  const checkSection = (): boolean => {
    const r = checkResponse(form, read(stateRef.current), current.questions);
    if (r.ok) return true;
    setErrors((e) => ({ ...e, ...r.errors }));
    setSummary(current.questions.filter((q) => r.errors[q.id]).map((q) => q.id));
    return false;
  };

  const next = () => {
    if (!checkSection()) return false;
    setSummary([]);
    setSection((s) => order.find((i) => i > s) ?? s);
    return true;
  };
  const back = () => {
    setSummary([]);
    setSection((s) => [...order].reverse().find((i) => i < s) ?? 0);
  };

  const send = async () => {
    if (sendingRef.current || !checkSection()) return;
    sendingRef.current = true;
    setStatus('sending');
    setFailure(null);
    const outcome = await submit(read(stateRef.current)).finally(() => {
      sendingRef.current = false;
    });
    if (outcome.kind === 'sent') {
      writeDraft(draftKey, null);
      setStatus('sent');
      return;
    }
    if (outcome.kind === 'closed') {
      setStatus('closed');
      return;
    }
    setStatus('filling');
    if (outcome.kind === 'invalid') {
      setErrors(outcome.errors);
      // Back to the first section holding an error.
      const bad = order.find((i) => form.sections[i]!.questions.some((q) => outcome.errors[q.id]));
      if (bad !== undefined) setSection(bad);
      const ids = (bad !== undefined ? form.sections[bad]!.questions : [])
        .filter((q) => outcome.errors[q.id])
        .map((q) => q.id);
      setSummary(ids);
      if (ids.length === 0)
        setFailure('Some answers could not be accepted. Check them and try again.');
      return;
    }
    setFailure(outcome.message);
  };

  const again = () => {
    setState(EMPTY);
    setErrors({});
    setSummary([]);
    setSection(0);
    setFailure(null);
    setStatus('filling');
  };

  return {
    state,
    section: at,
    current,
    last,
    // Where this section sits among those that show, and how many show.
    position: Math.max(0, order.indexOf(at)),
    count: order.length,
    errors,
    summary: summary.filter((id) => errors[id]),
    status,
    failure,
    setAnswer,
    setOther,
    blur,
    next,
    back,
    send,
    again,
  };
}
