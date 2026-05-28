export type GameMode = 'manual' | 'cheat' | 'agent';

export type GameStatus = 'ready' | 'running' | 'paused' | 'game-over';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  gravity: number;
  flapVelocity: number;
  pipeSpeed: number;
  pipeGap: number;
  pipeSpacing: number;
}

export interface BirdState {
  x: number;
  y: number;
  velocityY: number;
  size: number;
}

export interface PipeState {
  x: number;
  gapY: number;
  gapSize: number;
  width: number;
  scored: boolean;
}

export interface GameSnapshot {
  bird: BirdState;
  pipes: PipeState[];
  nextPipe: PipeState | null;
  score: number;
  flapCount: number;
  elapsedMs: number;
  status: GameStatus;
  mode: GameMode;
  difficulty: DifficultyId;
  width: number;
  height: number;
  groundY: number;
}

export interface CharacterTheme {
  id: string;
  name: string;
  bodyColor: string;
  wingColor: string;
  accentColor: string;
  eyeColor: string;
  imageUrl?: string;
  imageScale?: number;
  spriteFrames?: SpriteFrame[];
  animationStrips?: Partial<Record<SpriteAnimationName, string>>;
  stripFrameCount?: number;
  /** When false, uses one clean frame per strip file (no 7-frame loop). */
  stripAnimate?: boolean;
  /** Which frame to show when stripAnimate is false (0-based). */
  stripHeroFrameIndex?: number;
  /** Per-pose hero frame when stripAnimate is false (overrides stripHeroFrameIndex). */
  stripHeroFrameByPose?: Partial<Record<SpriteAnimationName, number>>;
  preserveAlpha?: boolean;
}

export interface SpriteFrame {
  name: 'idle' | 'flap' | 'peak' | 'fall1' | 'fall2' | 'fastFall' | 'dead';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SpriteAnimationName = 'idle' | 'flap' | 'peak' | 'fall' | 'dead';

export interface GameTheme {
  id: string;
  name: string;
  character: CharacterTheme;
  background: string;
  skyline: string;
  ground: string;
  pipe: string;
  pipeCap: string;
}
