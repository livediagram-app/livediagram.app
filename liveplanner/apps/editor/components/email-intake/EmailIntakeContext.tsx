'use client';

// The door to Email to Board (docs/specs/026-plan/email-to-board.md "Where it lives"): set by EmailIntakeHost for an
// Editor of the whole plan, on a tab holding a Plan board; null otherwise, so the tab menu's row reads one value and
// draws nothing without it.
import { createContext, useContext } from 'react';

// `badges`: what it needs first (Sync Plan) while a press opens its gate.
export type EmailIntakeDoor = { open: () => void; badges?: readonly string[] | undefined };

export const EmailIntakeDoorContext = createContext<EmailIntakeDoor | null>(null);

export const useEmailIntakeDoor = () => useContext(EmailIntakeDoorContext);
