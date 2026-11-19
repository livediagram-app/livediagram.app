'use client';

// The door to Publish Roadmap (docs/specs/026-plan/public-roadmap.md "Where it lives"): set by RoadmapHost for
// someone who may publish, on a plan with a Plan board; null otherwise, so the Tools row (roadmap-tools-item) reads one
// value and is left out without it.
import { createContext, useContext } from 'react';

export type RoadmapDoor = { open: () => void };

export const RoadmapDoorContext = createContext<RoadmapDoor | null>(null);

export const useRoadmapDoor = () => useContext(RoadmapDoorContext);
