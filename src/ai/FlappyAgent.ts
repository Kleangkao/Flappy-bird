import { DIFFICULTIES, updatePipes } from '../game/physics';
import type { GameSnapshot, PipeState } from '../game/types';

interface SimBird {
  y: number;
  velocityY: number;
}

export class FlappyAgent {
  private lastFlapAt = 0;

  shouldFlap(snapshot: GameSnapshot, now = performance.now()): boolean {
    if (snapshot.status !== 'running' || !snapshot.nextPipe) {
      return false;
    }

    const cooldownMs = this.getFlapCooldownMs(snapshot);
    const cooldownReady = now - this.lastFlapAt > cooldownMs;

    if (!cooldownReady || snapshot.bird.y < 46) {
      return false;
    }

    if (this.needsEmergencyFlap(snapshot)) {
      this.lastFlapAt = now;
      return true;
    }

    if (this.shouldHoldGlide(snapshot)) {
      return false;
    }

    const noFlapCost = this.scorePlan(snapshot, false);
    const flapCost = this.scorePlan(snapshot, true);

    if (flapCost + 9 < noFlapCost) {
      this.lastFlapAt = now;
      return true;
    }

    return false;
  }

  reset(): void {
    this.lastFlapAt = 0;
  }

  /** Block second flap while rising or already high in the gap (ceiling scrape). */
  private shouldHoldGlide(snapshot: GameSnapshot): boolean {
    if (snapshot.bird.velocityY < -155) {
      return true;
    }

    const birdTop = snapshot.bird.y - snapshot.bird.size / 2;

    if (birdTop < 72) {
      return true;
    }

    const nextPipe = snapshot.nextPipe;

    if (!nextPipe) {
      return snapshot.bird.y < 115 && snapshot.bird.velocityY < 40;
    }

    const gapTop = nextPipe.gapY - nextPipe.gapSize / 2;
    const safeTop = gapTop + snapshot.bird.size * 1.35;
    const distanceToPipe = nextPipe.x - snapshot.bird.x;

    if (distanceToPipe < 200 && birdTop < safeTop && snapshot.bird.velocityY < 90) {
      return true;
    }

    return false;
  }

  private needsEmergencyFlap(snapshot: GameSnapshot): boolean {
    if (this.isTooHighForEmergency(snapshot)) {
      return false;
    }

    const groundLimit = snapshot.groundY - snapshot.bird.size * 0.55;
    const nextPipe = snapshot.nextPipe;

    if (snapshot.bird.y > groundLimit && snapshot.bird.velocityY > 130) {
      return true;
    }

    if (!nextPipe) {
      return false;
    }

    const gapBottom = nextPipe.gapY + nextPipe.gapSize / 2;
    const safeBottom = gapBottom - snapshot.bird.size * 1.08;
    const birdBottom = snapshot.bird.y + snapshot.bird.size / 2;
    const distanceToPipe = nextPipe.x - snapshot.bird.x;
    const approaching = distanceToPipe < 175;

    if (!approaching) {
      return false;
    }

    if (birdBottom > safeBottom && snapshot.bird.velocityY > 60) {
      return true;
    }

    return false;
  }

  private isTooHighForEmergency(snapshot: GameSnapshot): boolean {
    const birdTop = snapshot.bird.y - snapshot.bird.size / 2;

    if (birdTop < 88) {
      return true;
    }

    const nextPipe = snapshot.nextPipe;

    if (!nextPipe) {
      return false;
    }

    const gapTop = nextPipe.gapY - nextPipe.gapSize / 2;
    const safeTop = gapTop + snapshot.bird.size * 1.2;

    return birdTop < safeTop && snapshot.bird.velocityY < 100;
  }

  private getFlapCooldownMs(snapshot: GameSnapshot): number {
    const difficulty = DIFFICULTIES[snapshot.difficulty];
    const frameCooldown = Math.round((1000 / 60) * 11);
    const velocityCooldown = Math.round(72000 / Math.abs(difficulty.flapVelocity));

    return Math.max(175, frameCooldown, velocityCooldown);
  }

  private getHorizonFrames(snapshot: GameSnapshot): number {
    const difficulty = DIFFICULTIES[snapshot.difficulty];
    const secondsAhead = (difficulty.pipeSpacing / difficulty.pipeSpeed) * 2.4;

    return Math.min(160, Math.max(96, Math.round(secondsAhead * 60)));
  }

  private scorePlan(snapshot: GameSnapshot, flapNow: boolean): number {
    const difficulty = DIFFICULTIES[snapshot.difficulty];
    const deltaSeconds = 1 / 60;
    const horizonFrames = this.getHorizonFrames(snapshot);
    const futureFlapCooldownFrames = 10;
    let pipes = snapshot.pipes.map((pipe) => ({ ...pipe }));
    const bird: SimBird = {
      y: snapshot.bird.y,
      velocityY: flapNow ? difficulty.flapVelocity : snapshot.bird.velocityY
    };
    let cost = flapNow ? 2.5 : 0;
    let cooldownFrames = flapNow ? futureFlapCooldownFrames : 0;

    for (let frame = 0; frame < horizonFrames; frame += 1) {
      if (cooldownFrames > 0) {
        cooldownFrames -= 1;
      }

      const nextPipe = this.getNextSimPipe(pipes, snapshot.bird.x);
      const targetY = nextPipe ? this.getTargetY(snapshot, nextPipe, bird.velocityY) : snapshot.groundY * 0.42;
      const lookAheadY = bird.y + bird.velocityY * 0.2;
      const birdTop = bird.y - snapshot.bird.size / 2;
      const canSimFlap =
        cooldownFrames === 0 &&
        lookAheadY > targetY + 14 &&
        bird.y > 56 &&
        bird.velocityY > -95 &&
        birdTop > 78;

      if (canSimFlap) {
        bird.velocityY = difficulty.flapVelocity;
        cooldownFrames = futureFlapCooldownFrames;
        cost += 1.05;
      }

      bird.velocityY += difficulty.gravity * deltaSeconds;
      bird.y += bird.velocityY * deltaSeconds;
      pipes = updatePipes(pipes, deltaSeconds, difficulty);

      const collisionPenalty = this.getCollisionPenalty(snapshot, bird, pipes, frame);

      if (collisionPenalty > 0) {
        return cost + collisionPenalty;
      }

      const activePipe = this.getNextSimPipe(pipes, snapshot.bird.x);
      const activeTarget = activePipe
        ? this.getTargetY(snapshot, activePipe, bird.velocityY)
        : snapshot.groundY * 0.42;
      const distanceToTarget = Math.abs(bird.y - activeTarget);
      const risePenalty = Math.max(0, -bird.velocityY - 170) * 0.02;
      const ceilingPenalty = Math.max(0, 100 - bird.y) * 0.06;

      cost += distanceToTarget * 0.02 + Math.max(0, bird.velocityY - 260) * 0.008 + risePenalty + ceilingPenalty;
    }

    return cost;
  }

  private getCollisionPenalty(
    snapshot: GameSnapshot,
    bird: SimBird,
    pipes: PipeState[],
    frame: number
  ): number {
    const birdTop = bird.y - snapshot.bird.size / 2;
    const birdBottom = bird.y + snapshot.bird.size / 2;

    if (birdTop < 0 || birdBottom > snapshot.groundY) {
      return 100000 - frame * 350;
    }

    if (birdTop < 24) {
      return 85000 - frame * 300;
    }

    for (const pipe of pipes) {
      const birdLeft = snapshot.bird.x - snapshot.bird.size / 2;
      const birdRight = snapshot.bird.x + snapshot.bird.size / 2;
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + pipe.width;
      const gapTop = pipe.gapY - pipe.gapSize / 2;
      const gapBottom = pipe.gapY + pipe.gapSize / 2;
      const overlapsHorizontally = birdRight > pipeLeft && birdLeft < pipeRight;
      const outsideGap = birdTop < gapTop || birdBottom > gapBottom;

      if (overlapsHorizontally && outsideGap) {
        return 90000 - frame * 350;
      }
    }

    return 0;
  }

  private getTargetY(snapshot: GameSnapshot, pipe: PipeState, velocityY: number): number {
    const gapTop = pipe.gapY - pipe.gapSize / 2;
    const gapBottom = pipe.gapY + pipe.gapSize / 2;
    const safeTop = gapTop + snapshot.bird.size * 1.25;
    const safeBottom = gapBottom - snapshot.bird.size * 1.22;
    const distanceToPipe = pipe.x - snapshot.bird.x;
    const approachBias = distanceToPipe < 90 ? 2 : distanceToPipe < 170 ? -2 : -12;
    const fallBias = velocityY > 200 ? -12 : velocityY < -140 ? 14 : velocityY < -60 ? 6 : 0;

    return Math.max(safeTop, Math.min(safeBottom, pipe.gapY + approachBias + fallBias));
  }

  private getNextSimPipe(pipes: PipeState[], birdX: number): PipeState | null {
    return pipes.find((pipe) => pipe.x + pipe.width >= birdX - 36) ?? null;
  }
}
