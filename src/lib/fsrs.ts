/**
 * FSRS-4.5 scheduler (Free Spaced Repetition Scheduler), pure functions.
 *
 * Faithful to the published algorithm with its default 17 weights:
 * stability/difficulty state per card, power-law forgetting curve
 * R(t,S) = (1 + F·t/S)^C with C = -0.5, F = 19/81 (so the next interval at
 * the default 0.9 desired retention works out to ≈ S days).
 *
 * Deliberate simplification for this app: no separate short-term
 * (learning-steps) state machine — "again" on a young card just yields a
 * short fractional-day interval from the same formulas. Every review is
 * logged with the full set of data points (elapsed time, retrievability,
 * stability/difficulty before and after) so a future parameter optimizer
 * has everything it needs.
 */

export type FsrsRating = 1 | 2 | 3 | 4; // again | hard | good | easy
export const RATING_LABELS: Record<FsrsRating, string> = {
  1: "again",
  2: "hard",
  3: "good",
  4: "easy",
};

export type FsrsState = {
  stability: number | null;
  difficulty: number | null;
  dueAt: number;
  reps: number;
  lapses: number;
  lastReviewedAt: number | null;
};

export type FsrsReviewResult = {
  state: FsrsState;
  log: {
    rating: FsrsRating;
    reviewedAt: number;
    elapsedDays: number;
    retrievability: number | null;
    stabilityBefore: number | null;
    stabilityAfter: number;
    difficultyBefore: number | null;
    difficultyAfter: number;
    scheduledDays: number;
  };
};

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DESIRED_RETENTION = 0.9;
const DAY_MS = 86_400_000;
const MIN_INTERVAL_DAYS = 10 / (60 * 24); // 10 minutes
const MAX_INTERVAL_DAYS = 36_500;

export function newFsrsState(now = Date.now()): FsrsState {
  return {
    stability: null,
    difficulty: null,
    dueAt: now,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function nextIntervalDays(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1);
  return Math.min(Math.max(days, MIN_INTERVAL_DAYS), MAX_INTERVAL_DAYS);
}

function initStability(rating: FsrsRating): number {
  return Math.max(W[rating - 1], 0.1);
}

function initDifficulty(rating: FsrsRating): number {
  return clampDifficulty(W[4] - (rating - 3) * W[5]);
}

function clampDifficulty(d: number): number {
  return Math.min(Math.max(d, 1), 10);
}

function nextDifficulty(d: number, rating: FsrsRating): number {
  const updated = d - W[6] * (rating - 3);
  // Mean reversion toward the initial "easy" difficulty keeps D from
  // drifting to the extremes over long histories.
  return clampDifficulty(W[7] * initDifficulty(4) + (1 - W[7]) * updated);
}

function recallStability(d: number, s: number, r: number, rating: FsrsRating): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function forgetStability(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(sf, s);
}

export function reviewCard(
  state: FsrsState,
  rating: FsrsRating,
  now = Date.now(),
): FsrsReviewResult {
  const stabilityBefore = state.stability;
  const difficultyBefore = state.difficulty;

  let stability: number;
  let difficulty: number;
  let elapsedDays = 0;
  let r: number | null = null;

  if (state.stability === null || state.difficulty === null || state.lastReviewedAt === null) {
    stability = initStability(rating);
    difficulty = initDifficulty(rating);
  } else {
    elapsedDays = Math.max(0, (now - state.lastReviewedAt) / DAY_MS);
    r = retrievability(elapsedDays, state.stability);
    difficulty = nextDifficulty(state.difficulty, rating);
    stability =
      rating === 1
        ? forgetStability(state.difficulty, state.stability, r)
        : recallStability(state.difficulty, state.stability, r, rating);
  }
  stability = Math.max(stability, 0.01);

  const scheduledDays = rating === 1 ? MIN_INTERVAL_DAYS : nextIntervalDays(stability);
  const next: FsrsState = {
    stability,
    difficulty,
    dueAt: now + scheduledDays * DAY_MS,
    reps: state.reps + 1,
    lapses: state.lapses + (rating === 1 && state.reps > 0 ? 1 : 0),
    lastReviewedAt: now,
  };

  return {
    state: next,
    log: {
      rating,
      reviewedAt: now,
      elapsedDays,
      retrievability: r,
      stabilityBefore,
      stabilityAfter: stability,
      difficultyBefore,
      difficultyAfter: difficulty,
      scheduledDays,
    },
  };
}

export function isDue(state: FsrsState, now = Date.now()): boolean {
  return state.dueAt <= now;
}
