import type { DifficultyId, GameMode } from '../game/types';

export interface LocalRun {
  id: string;
  score: number;
  playerName: string;
  characterId: string;
  mode: GameMode;
  difficulty: DifficultyId;
  createdAt: string;
}

export interface LocalScoreState {
  bestScore: number;
  runs: LocalRun[];
}

const STORAGE_KEY = 'flappy-local-scores';
const MAX_RUNS = 10;

export function loadLocalScores(): LocalScoreState {
  const fallback: LocalScoreState = {
    bestScore: 0,
    runs: []
  };
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as LocalScoreState;

    const runs = Array.isArray(parsed.runs) ? parsed.runs.slice(0, MAX_RUNS) : [];

    return {
      bestScore: computeBestScore(runs),
      runs
    };
  } catch {
    return fallback;
  }
}

function countsTowardBest(mode: GameMode | string): boolean {
  return mode !== 'cheat' && mode !== 'ai';
}

function computeBestScore(runs: LocalRun[]): number {
  return runs.reduce((best, run) => (countsTowardBest(run.mode) ? Math.max(best, run.score) : best), 0);
}

export function saveLocalRun(run: Omit<LocalRun, 'id' | 'createdAt'>): LocalScoreState {
  const current = loadLocalScores();
  const nextRun: LocalRun = {
    ...run,
    id: crypto.randomUUID(),
    createdAt: new Date().toLocaleString()
  };
  const runs = [nextRun, ...current.runs].slice(0, MAX_RUNS);
  const nextState: LocalScoreState = {
    bestScore: computeBestScore(runs),
    runs
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function resetLocalScores(): LocalScoreState {
  const emptyState: LocalScoreState = {
    bestScore: 0,
    runs: []
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyState));
  return emptyState;
}
