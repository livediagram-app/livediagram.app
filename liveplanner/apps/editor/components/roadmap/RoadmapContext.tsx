'use client';

// The door to Publish as Roadmap (docs/specs/026-plan/public-roadmap.md "Where it lives"): set by RoadmapHost for
// someone who may publish, on a tab holding a Plan board; null otherwise, so the tab menu's row reads one value and
// draws nothing without it.
import { createContext, useContext } from 'react';

export type RoadmapDoor = { open: () => void };

export const RoadmapDoorContext = createContext<RoadmapDoor | null>(null);

export const useRoadmapDoor = () => useContext(RoadmapDoorContext);
