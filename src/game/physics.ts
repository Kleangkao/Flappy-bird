import type { BirdState, DifficultyConfig, DifficultyId, PipeState } from './types';

export const GAME_WIDTH = 420;
export const GAME_HEIGHT = 640;
export const GROUND_HEIGHT = 84;
export const BIRD_SIZE = 34;
export const PIPE_WIDTH = 74;
export const PIPE_GAP = 164;
export const PIPE_SPACING = 232;
export const PIPE_SPEED = 156;
export const GRAVITY = 1450;
export const FLAP_VELOCITY = -440;
export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    gravity: 1280,
    flapVelocity: -420,
    pipeSpeed: 136,
    pipeGap: 186,
    pipeSpacing: 252
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    gravity: GRAVITY,
    flapVelocity: FLAP_VELOCITY,
    pipeSpeed: PIPE_SPEED,
    pipeGap: PIPE_GAP,
    pipeSpacing: PIPE_SPACING
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    gravity: 1580,
    flapVelocity: -455,
    pipeSpeed: 178,
    pipeGap: 142,
    pipeSpacing: 218
  }
};

const START_X = 112;
const START_Y = 260;
const MIN_GAP_Y = 150;
const MAX_GAP_Y = GAME_HEIGHT - GROUND_HEIGHT - 150;

export function createBird(): BirdState {
  return {
    x: START_X,
    y: START_Y,
    velocityY: 0,
    size: BIRD_SIZE
  };
}

export function flapBird(bird: BirdState, difficulty = DIFFICULTIES.normal): BirdState {
  return {
    ...bird,
    velocityY: difficulty.flapVelocity
  };
}

export function updateBird(
  bird: BirdState,
  deltaSeconds: number,
  difficulty = DIFFICULTIES.normal
): BirdState {
  const velocityY = bird.velocityY + difficulty.gravity * deltaSeconds;

  return {
    ...bird,
    velocityY,
    y: bird.y + velocityY * deltaSeconds
  };
}

export function createPipe(x: number, difficulty = DIFFICULTIES.normal): PipeState {
  return {
    x,
    gapY: randomGapY(),
    gapSize: difficulty.pipeGap,
    width: PIPE_WIDTH,
    scored: false
  };
}

export function updatePipes(
  pipes: PipeState[],
  deltaSeconds: number,
  difficulty = DIFFICULTIES.normal
): PipeState[] {
  const moved = pipes
    .map((pipe) => ({
      ...pipe,
      x: pipe.x - difficulty.pipeSpeed * deltaSeconds
    }))
    .filter((pipe) => pipe.x + pipe.width > -20);

  const rightMostPipeX = moved.reduce((rightMost, pipe) => Math.max(rightMost, pipe.x), 0);

  if (moved.length === 0 || rightMostPipeX < GAME_WIDTH - difficulty.pipeSpacing) {
    moved.push(createPipe(Math.max(GAME_WIDTH + 40, rightMostPipeX + difficulty.pipeSpacing), difficulty));
  }

  return moved;
}

export function hasHitWorldBounds(bird: BirdState): boolean {
  return bird.y - bird.size / 2 < 0 || bird.y + bird.size / 2 > GAME_HEIGHT - GROUND_HEIGHT;
}

export function hasHitPipe(bird: BirdState, pipe: PipeState): boolean {
  const birdLeft = bird.x - bird.size / 2;
  const birdRight = bird.x + bird.size / 2;
  const birdTop = bird.y - bird.size / 2;
  const birdBottom = bird.y + bird.size / 2;
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;
  const gapTop = pipe.gapY - pipe.gapSize / 2;
  const gapBottom = pipe.gapY + pipe.gapSize / 2;

  const overlapsHorizontally = birdRight > pipeLeft && birdLeft < pipeRight;
  const outsideGap = birdTop < gapTop || birdBottom > gapBottom;

  return overlapsHorizontally && outsideGap;
}

export function getNextPipe(pipes: PipeState[], birdX: number): PipeState | null {
  return pipes.find((pipe) => pipe.x + pipe.width >= birdX - BIRD_SIZE) ?? null;
}

function randomGapY(): number {
  return MIN_GAP_Y + Math.random() * (MAX_GAP_Y - MIN_GAP_Y);
}
