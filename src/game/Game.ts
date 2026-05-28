import { FlappyAgent } from '../ai/FlappyAgent';
import { defaultTheme } from '../themes/themes';
import {
  createBird,
  createPipe,
  DIFFICULTIES,
  flapBird,
  GAME_HEIGHT,
  GAME_WIDTH,
  getNextPipe,
  GROUND_HEIGHT,
  hasHitPipe,
  hasHitWorldBounds,
  updateBird,
  updatePipes
} from './physics';
import type {
  BirdState,
  DifficultyConfig,
  DifficultyId,
  GameMode,
  GameSnapshot,
  GameStatus,
  GameTheme,
  PipeState,
  SpriteAnimationName,
  SpriteFrame
} from './types';

interface GameCallbacks {
  onScore?: (score: number) => void;
  onGameOver?: (score: number) => void;
  onFlap?: () => void;
  onHit?: () => void;
  onStart?: () => void;
  onStateChange?: (snapshot: GameSnapshot) => void;
}

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GameCallbacks;
  private readonly agent = new FlappyAgent();
  private bird: BirdState = createBird();
  private pipes: PipeState[] = [];
  private score = 0;
  private flapCount = 0;
  private status: GameStatus = 'ready';
  private mode: GameMode = 'manual';
  private difficulty: DifficultyConfig = DIFFICULTIES.normal;
  private theme: GameTheme = defaultTheme;
  private characterImage: HTMLImageElement | null = null;
  private characterImageReady = false;
  private characterFrames = new Map<SpriteFrame['name'], HTMLCanvasElement>();
  private animationStrips = new Map<SpriteAnimationName, HTMLCanvasElement[]>();
  private animationFrame = 0;
  private lastFrameTime = 0;
  private runStartedAt = 0;
  private pausedAt = 0;
  private totalPausedMs = 0;

  constructor(private readonly canvas: HTMLCanvasElement, callbacks: GameCallbacks = {}) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }

    this.ctx = context;
    this.callbacks = callbacks;
    this.canvas.width = GAME_WIDTH;
    this.canvas.height = GAME_HEIGHT;
    this.reset();
    this.loop = this.loop.bind(this);
  }

  mount(): void {
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  start(): void {
    if (this.status === 'running') {
      return;
    }

    if (this.status === 'paused') {
      this.resume();
      return;
    }

    if (this.status === 'game-over') {
      this.reset();
    }

    this.status = 'running';
    this.runStartedAt = performance.now();
    this.totalPausedMs = 0;
    this.lastFrameTime = performance.now();
    this.callbacks.onStart?.();
    this.emitState();
  }

  restart(): void {
    this.reset();
    this.start();
  }

  flap(): void {
    if (this.status === 'game-over') {
      this.restart();
      return;
    }

    if (this.status === 'ready') {
      this.start();
    }

    if (this.status !== 'running') {
      return;
    }

    this.bird = flapBird(this.bird, this.difficulty);
    this.flapCount += 1;
    this.callbacks.onFlap?.();
  }

  pause(): void {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'paused';
    this.pausedAt = performance.now();
    this.emitState();
  }

  resume(): void {
    if (this.status !== 'paused') {
      return;
    }

    this.status = 'running';
    this.totalPausedMs += performance.now() - this.pausedAt;
    this.lastFrameTime = performance.now();
    this.emitState();
  }

  togglePause(): void {
    if (this.status === 'running') {
      this.pause();
      return;
    }

    if (this.status === 'paused') {
      this.resume();
    }
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.emitState();
  }

  getMode(): GameMode {
    return this.mode;
  }

  setDifficulty(difficultyId: DifficultyId): void {
    this.difficulty = DIFFICULTIES[difficultyId];

    if (this.status !== 'running') {
      this.reset();
    }

    this.emitState();
  }

  getDifficulty(): DifficultyId {
    return this.difficulty.id;
  }

  setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.loadCharacterImage(theme.character.imageUrl);
    this.draw();
    this.emitState();
  }

  getSnapshot(): GameSnapshot {
    return {
      bird: { ...this.bird },
      pipes: this.pipes.map((pipe) => ({ ...pipe })),
      nextPipe: getNextPipe(this.pipes, this.bird.x),
      score: this.score,
      flapCount: this.flapCount,
      elapsedMs: this.getElapsedMs(),
      status: this.status,
      mode: this.mode,
      difficulty: this.difficulty.id,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      groundY: GAME_HEIGHT - GROUND_HEIGHT
    };
  }

  private reset(): void {
    this.bird = createBird();
    this.pipes = [
      createPipe(GAME_WIDTH + 40, this.difficulty),
      createPipe(GAME_WIDTH + 40 + this.difficulty.pipeSpacing, this.difficulty)
    ];
    this.score = 0;
    this.flapCount = 0;
    this.status = 'ready';
    this.runStartedAt = 0;
    this.pausedAt = 0;
    this.totalPausedMs = 0;
    this.agent.reset();
    this.draw();
    this.emitState();
  }

  private loop(frameTime: number): void {
    const deltaSeconds = Math.min((frameTime - this.lastFrameTime) / 1000, 0.032);
    this.lastFrameTime = frameTime;

    if (this.status === 'running') {
      this.update(deltaSeconds, frameTime);
    }

    this.draw();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  private update(deltaSeconds: number, frameTime: number): void {
    if (this.mode === 'cheat') {
      this.applyGodAutopilot(deltaSeconds);
    } else if (this.mode === 'agent' && this.agent.shouldFlap(this.getSnapshot(), frameTime)) {
      this.flap();
    }

    this.bird = updateBird(this.bird, deltaSeconds, this.difficulty);
    this.pipes = updatePipes(this.pipes, deltaSeconds, this.difficulty);
    this.updateScore();

    if (this.mode === 'cheat') {
      this.preventAiDeath();
    } else if (hasHitWorldBounds(this.bird) || this.pipes.some((pipe) => hasHitPipe(this.bird, pipe))) {
      this.status = 'game-over';
      this.callbacks.onHit?.();
      this.callbacks.onGameOver?.(this.score);
    }

    this.emitState();
  }

  private applyGodAutopilot(deltaSeconds: number): void {
    const targetY = this.getAiTargetY();
    const errorY = targetY - this.bird.y;
    const desiredVelocity = clamp(errorY / Math.max(deltaSeconds * 7.5, 0.08), -520, 420);
    const smoothing = 0.42;

    this.bird = {
      ...this.bird,
      velocityY: this.bird.velocityY + (desiredVelocity - this.bird.velocityY) * smoothing
    };
  }

  private preventAiDeath(): void {
    const safeY = this.getAiTargetY();
    const topLimit = this.bird.size / 2 + 6;
    const bottomLimit = GAME_HEIGHT - GROUND_HEIGHT - this.bird.size / 2 - 6;
    let nextY = clamp(this.bird.y, topLimit, bottomLimit);

    for (const pipe of this.pipes) {
      if (!hasHitPipe({ ...this.bird, y: nextY }, pipe)) {
        continue;
      }

      nextY = clamp(pipe.gapY, pipe.gapY - pipe.gapSize / 2 + this.bird.size, pipe.gapY + pipe.gapSize / 2 - this.bird.size);
    }

    this.bird = {
      ...this.bird,
      y: Number.isFinite(nextY) ? nextY : safeY,
      velocityY: clamp(this.bird.velocityY, -360, 300)
    };
  }

  private getAiTargetY(): number {
    const nextPipe = getNextPipe(this.pipes, this.bird.x);

    if (!nextPipe) {
      return (GAME_HEIGHT - GROUND_HEIGHT) * 0.44;
    }

    const distanceToPipe = nextPipe.x - this.bird.x;
    const gapTop = nextPipe.gapY - nextPipe.gapSize / 2;
    const gapBottom = nextPipe.gapY + nextPipe.gapSize / 2;
    const margin = this.bird.size * 1.2;
    const safeTop = gapTop + margin;
    const safeBottom = gapBottom - margin;
    const approachBias = distanceToPipe < 90 ? 6 : -8;

    return clamp(nextPipe.gapY + approachBias, safeTop, safeBottom);
  }

  private updateScore(): void {
    this.pipes = this.pipes.map((pipe) => {
      if (!pipe.scored && pipe.x + pipe.width < this.bird.x) {
        const nextScore = this.score + 1;
        this.score = nextScore;
        this.callbacks.onScore?.(nextScore);
        return { ...pipe, scored: true };
      }

      return pipe;
    });
  }

  private draw(): void {
    this.drawBackground();
    this.drawPipes();
    this.drawBird();
    this.drawGround();
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, this.theme.background);
    gradient.addColorStop(1, this.theme.skyline);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    this.ctx.beginPath();
    this.ctx.arc(70, 86, 30, 0, Math.PI * 2);
    this.ctx.arc(98, 86, 42, 0, Math.PI * 2);
    this.ctx.arc(132, 86, 28, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    this.ctx.beginPath();
    this.ctx.arc(286, 148, 26, 0, Math.PI * 2);
    this.ctx.arc(314, 148, 34, 0, Math.PI * 2);
    this.ctx.arc(348, 148, 24, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPipes(): void {
    for (const pipe of this.pipes) {
      const gapTop = pipe.gapY - pipe.gapSize / 2;
      const gapBottom = pipe.gapY + pipe.gapSize / 2;

      this.ctx.fillStyle = this.theme.pipe;
      this.ctx.fillRect(pipe.x, 0, pipe.width, gapTop);
      this.ctx.fillRect(pipe.x, gapBottom, pipe.width, GAME_HEIGHT - GROUND_HEIGHT - gapBottom);

      this.ctx.fillStyle = this.theme.pipeCap;
      this.ctx.fillRect(pipe.x - 8, gapTop - 24, pipe.width + 16, 24);
      this.ctx.fillRect(pipe.x - 8, gapBottom, pipe.width + 16, 24);
    }
  }

  private drawBird(): void {
    const { character } = this.theme;
    const radius = this.bird.size / 2;

    this.ctx.save();
    this.ctx.translate(this.bird.x, this.bird.y);
    this.ctx.rotate(Math.max(-0.45, Math.min(0.6, this.bird.velocityY / 700)));

    if (this.drawCharacterImage()) {
      this.ctx.restore();
      return;
    }

    this.ctx.fillStyle = character.wingColor;
    this.ctx.beginPath();
    this.ctx.ellipse(-8, 7, 17, 10, -0.35, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = character.bodyColor;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = character.accentColor;
    this.ctx.beginPath();
    this.ctx.moveTo(radius - 3, -2);
    this.ctx.lineTo(radius + 16, 4);
    this.ctx.lineTo(radius - 2, 11);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = character.eyeColor;
    this.ctx.beginPath();
    this.ctx.arc(8, -7, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawCharacterImage(): boolean {
    const { character } = this.theme;

    if (!this.characterImageReady) {
      return false;
    }

    const scale = character.imageScale ?? 1;
    const isDead = this.status === 'game-over';
    const framePulse = isDead ? 0 : Math.sin(performance.now() / 95) * 0.06;
    const fallSquash = Math.max(-0.08, Math.min(0.08, this.bird.velocityY / 6000));
    const frame = this.getActiveCharacterFrame();
    const image = frame ?? this.characterImage;

    if (!image) {
      return false;
    }

    const maxDim = Math.max(image.width, image.height, 1);
    const drawSize = this.bird.size * scale;
    const width = (image.width / maxDim) * drawSize * (1 + framePulse);
    const height = (image.height / maxDim) * drawSize * (1 - fallSquash);

    this.ctx.drawImage(image, -width / 2, -height / 2, width, height);
    return true;
  }

  private getActiveCharacterFrame(): HTMLCanvasElement | null {
    if (this.animationStrips.size > 0) {
      return this.getActiveStripFrame();
    }

    if (this.characterFrames.size === 0) {
      return null;
    }

    if (this.status === 'game-over') {
      return this.characterFrames.get('dead') ?? null;
    }

    if (this.bird.velocityY < -250) {
      return performance.now() % 160 < 80
        ? this.characterFrames.get('flap') ?? null
        : this.characterFrames.get('peak') ?? null;
    }

    if (this.bird.velocityY < 60) {
      return this.characterFrames.get('peak') ?? this.characterFrames.get('idle') ?? null;
    }

    if (this.bird.velocityY < 260) {
      return this.characterFrames.get('fall1') ?? this.characterFrames.get('idle') ?? null;
    }

    if (this.bird.velocityY < 520) {
      return this.characterFrames.get('fall2') ?? this.characterFrames.get('idle') ?? null;
    }

    return this.characterFrames.get('fastFall') ?? this.characterFrames.get('fall2') ?? null;
  }

  private getActiveStripFrame(): HTMLCanvasElement | null {
    const animation = this.getActiveAnimationName();
    const frames = this.animationStrips.get(animation) ?? this.animationStrips.get('idle');

    if (!frames || frames.length === 0) {
      return null;
    }

    if (animation === 'dead') {
      return frames[frames.length - 1] ?? frames[0] ?? null;
    }

    const { character } = this.theme;

    if (character.stripAnimate === false) {
      return frames[0] ?? null;
    }

    const frameDuration = animation === 'idle' ? 160 : 70;
    const baseIndex = Math.floor(performance.now() / frameDuration) % frames.length;

    return frames[baseIndex] ?? frames[0] ?? null;
  }

  private getActiveAnimationName(): SpriteAnimationName {
    if (this.status === 'game-over') {
      return 'dead';
    }

    if (this.status === 'ready' || this.status === 'paused') {
      return 'idle';
    }

    // flap: rising | peak: crest only | fall: descending (before fall, peak showed Tigu tail).
    if (this.bird.velocityY < -70) {
      return 'flap';
    }

    if (this.bird.velocityY > 35) {
      return 'fall';
    }

    if (this.bird.velocityY <= 35) {
      return 'peak';
    }

    return 'idle';
  }

  private drawGround(): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;

    this.ctx.fillStyle = this.theme.ground;
    this.ctx.fillRect(0, groundY, GAME_WIDTH, GROUND_HEIGHT);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';

    for (let x = -20; x < GAME_WIDTH + 20; x += 34) {
      this.ctx.fillRect(x, groundY + 18, 20, 6);
    }
  }


  private emitState(): void {
    this.callbacks.onStateChange?.(this.getSnapshot());
  }

  private loadCharacterImage(imageUrl?: string): void {
    this.characterImage = null;
    this.characterImageReady = false;
    this.characterFrames.clear();
    this.animationStrips.clear();

    if (this.theme.character.animationStrips) {
      this.loadAnimationStrips();
      return;
    }

    if (!imageUrl) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      this.characterFrames = this.buildCharacterFrames(image);
      this.characterImageReady = true;
      this.draw();
    };
    image.onerror = () => {
      this.characterImage = null;
      this.characterImageReady = false;
    };
    image.src = imageUrl;
    this.characterImage = image;
  }

  private loadAnimationStrips(): void {
    const strips = Object.entries(this.theme.character.animationStrips ?? {}) as Array<[SpriteAnimationName, string]>;

    if (strips.length === 0) {
      return;
    }

    let loadedCount = 0;

    for (const [animation, url] of strips) {
      const image = new Image();
      image.onload = () => {
        this.animationStrips.set(animation, this.buildStripFrames(image, animation));
        loadedCount += 1;

        if (loadedCount === strips.length) {
          this.characterImageReady = true;
          this.draw();
        }
      };
      image.onerror = () => {
        loadedCount += 1;

        if (loadedCount === strips.length) {
          this.characterImageReady = this.animationStrips.size > 0;
          this.draw();
        }
      };
      image.src = url;
    }
  }

  private getStripHeroFrameIndex(animation: SpriteAnimationName, frameCount: number): number {
    const { character } = this.theme;
    const poseIndex = character.stripHeroFrameByPose?.[animation];

    if (poseIndex !== undefined) {
      return Math.min(Math.max(0, poseIndex), frameCount - 1);
    }

    if (animation === 'dead') {
      return frameCount - 1;
    }

    return Math.min(character.stripHeroFrameIndex ?? 0, frameCount - 1);
  }

  private buildStripFrames(image: HTMLImageElement, animation: SpriteAnimationName): HTMLCanvasElement[] {
    const frameCount = this.theme.character.stripFrameCount ?? 1;
    const frameWidth = Math.floor(image.width / frameCount);
    const animate = this.theme.character.stripAnimate ?? true;

    if (!animate) {
      const heroIndex = this.getStripHeroFrameIndex(animation, frameCount);

      return [this.buildSingleStripFrame(image, heroIndex, frameWidth)];
    }

    const sliceBleed = 3;
    const frames: HTMLCanvasElement[] = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      frames.push(this.buildSingleStripFrame(image, frameIndex, frameWidth, sliceBleed));
    }

    return frames;
  }

  private buildSingleStripFrame(
    image: HTMLImageElement,
    frameIndex: number,
    frameWidth: number,
    sliceBleed = 0
  ): HTMLCanvasElement {
    const sourceX = Math.max(0, frameIndex * frameWidth - sliceBleed);
    const sourceRight = Math.min(image.width, (frameIndex + 1) * frameWidth + sliceBleed);
    const sourceWidth = sourceRight - sourceX;
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = image.height;
    const context = canvas.getContext('2d');

    if (!context) {
      return canvas;
    }

    context.drawImage(image, sourceX, 0, sourceWidth, image.height, 0, 0, sourceWidth, image.height);
    this.applyStripBackgroundKeying(context, sourceWidth, image.height);

    return this.trimCanvasToContent(canvas, sliceBleed > 0 ? 4 : 8);
  }

  private buildCharacterFrames(image: HTMLImageElement): Map<SpriteFrame['name'], HTMLCanvasElement> {
    const frames = new Map<SpriteFrame['name'], HTMLCanvasElement>();

    for (const frame of this.theme.character.spriteFrames ?? []) {
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext('2d');

      if (!context) {
        continue;
      }

      context.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
      this.makeDarkPixelsTransparent(context, frame.width, frame.height);
      frames.set(frame.name, canvas);
    }

    return frames;
  }

  private applyStripBackgroundKeying(context: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.theme.character.preserveAlpha) {
      // Puri: keep dark pixels (eyes). Do not run black keying added for Tigu strips.
      return;
    }

    this.removeSolidBlackBackground(context, width, height);
  }

  private removeSolidBlackBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];

      if (red <= 18 && green <= 18 && blue <= 18) {
        pixels[index + 3] = 0;
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  private makeDarkPixelsTransparent(context: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha === 0) {
        continue;
      }

      const isDarkBackground = red < 42 && green < 48 && blue < 56;

      if (isDarkBackground) {
        pixels[index + 3] = 0;
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  private trimCanvasToContent(source: HTMLCanvasElement, padding = 4): HTMLCanvasElement {
    const context = source.getContext('2d');

    if (!context || source.width === 0 || source.height === 0) {
      return source;
    }

    const { width, height } = source;
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = pixels[(y * width + x) * 4 + 3];

        if (alpha > 12) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return source;
    }

    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
    const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
    const trimmed = document.createElement('canvas');
    trimmed.width = cropW;
    trimmed.height = cropH;
    const trimmedContext = trimmed.getContext('2d');

    if (!trimmedContext) {
      return source;
    }

    trimmedContext.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return trimmed;
  }

  private getElapsedMs(): number {
    if (this.runStartedAt === 0) {
      return 0;
    }

    const now = this.status === 'paused' ? this.pausedAt : performance.now();

    return Math.max(0, Math.round(now - this.runStartedAt - this.totalPausedMs));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
