/** Reputation helpers (and, later, how factions read the parts you wear). SPOILERS. */
import type { RunState } from './run';

export function clampRep(run: RunState, fid: string, delta: number) {
  run.rep[fid] = Math.max(-100, Math.min(100, (run.rep[fid] ?? 0) + delta));
}
