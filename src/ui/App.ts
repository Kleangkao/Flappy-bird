import { Game } from '../game/Game';

import { DIFFICULTIES } from '../game/physics';

import type { DifficultyId, GameMode, GameSnapshot, GameStatus } from '../game/types';

import { loadLocalScores, resetLocalScores, saveLocalRun, type LocalScoreState } from '../services/localScores';

import { SoundManager } from '../services/sound';

import { defaultTheme, getModeLabel, getThemeById, getThemeNameByCharacterId, themes } from '../themes/themes';



export class App {

  private game: Game | null = null;

  private localScores: LocalScoreState = loadLocalScores();

  private selectedTheme = defaultTheme;

  private readonly sound = new SoundManager();

  private playerName = loadPlayerName();

  private lastStatus: GameStatus = 'ready';

  private scorePulseTimer = 0;



  constructor(private readonly root: HTMLDivElement) {}



  mount(): void {

    this.render();

    this.mountGame();

    this.bindEvents();
    this.updatePageTitle();

    this.renderLocalScores();

    if (this.game) {
      this.updateOverlays(this.game.getSnapshot());
    }
  }



  destroy(): void {

    window.clearTimeout(this.scorePulseTimer);

    this.game?.destroy();

  }



  private render(): void {

    this.root.innerHTML = `

      <main class="app-shell">

        <header class="page-header">

          <h1 class="page-title" id="pageTitle">${escapeHtml(this.selectedTheme.name)}</h1>

        </header>



        <section class="game-card" id="gameCard">

          <div class="game-topbar">

            <div class="topbar-stat">

              <span class="eyebrow">Score</span>

              <strong id="scoreText">0</strong>

            </div>

            <div class="topbar-stat">

              <span class="eyebrow">Mode</span>

              <strong id="modeText">Manual</strong>

            </div>

          </div>



          <div class="game-stage">

            <div class="game-bezel">

              <canvas id="gameCanvas" aria-label="Game canvas"></canvas>

              <div class="hud-overlay" aria-live="polite">

                <p id="hudScore" class="hud-score">0</p>

              </div>

              <div id="screenReady" class="screen-overlay">

                <div class="screen-card">

                  <h3>Ready to fly</h3>

                  <p>Press Space or Start to begin. Tap the game to pause.</p>

                </div>

              </div>

              <div id="screenPaused" class="screen-overlay is-hidden">

                <div class="screen-card">

                  <h3>Paused</h3>

                  <p>Press P or Space to resume. Tap the game too.</p>

                </div>

              </div>

              <div id="screenGameOver" class="screen-overlay is-hidden">

                <div class="screen-card screen-card-danger">

                  <h3>Game Over</h3>

                  <p id="gameOverScore">Score: 0</p>

                  <button type="button" id="overlayRestartButton" class="primary">Play again</button>

                </div>

              </div>

            </div>

          </div>



          <div class="controls">

            <button id="startButton" class="primary">Start / Restart</button>

            <button id="pauseButton" class="ghost">Pause</button>

            <label class="toggle toggle-cheat">

              <input id="cheatToggle" type="checkbox" />

              <span>Cheat Mode</span>

            </label>

            <label class="toggle toggle-agent">

              <input id="agentToggle" type="checkbox" />

              <span>Pro Agent</span>

            </label>

            <label class="toggle">

              <input id="soundToggle" type="checkbox" checked />

              <span>Sound</span>

            </label>

          </div>

          <p class="hint">Space = flap (or resume when paused). P = pause or resume. Click game = pause or resume.</p>

        </section>



        <aside class="side-panel">

          <p class="panel-section-label">Play</p>

          <section class="panel settings-panel">

            <h2>Skin / Character</h2>

            <label class="field-label" for="themeSelect">Choose skin</label>

            <select id="themeSelect" aria-label="Choose character">

              ${themes.map((theme) => `<option value="${theme.id}" ${theme.id === this.selectedTheme.id ? 'selected' : ''}>${theme.name}</option>`).join('')}

            </select>

            <h2 class="stacked-heading">Game Settings</h2>

            <label class="field-label" for="difficultySelect">Difficulty</label>

            <select id="difficultySelect" aria-label="Choose difficulty">

              ${Object.values(DIFFICULTIES)

                .map((difficulty) => `<option value="${difficulty.id}">${difficulty.name}</option>`)

                .join('')}

            </select>

          </section>



          <p class="panel-section-label">You</p>

          <section class="panel">

            <h2>Player</h2>

            <p class="status-text">Scores save on this device. Cheat runs are logged but do not count toward best.</p>

            <label class="field-label" for="playerNameInput">Player name</label>

            <input id="playerNameInput" maxlength="24" value="${escapeHtml(this.playerName)}" />

          </section>



          <p class="panel-section-label">Stats</p>

          <section class="panel leaderboard-panel">

            <div class="panel-heading">

              <h2>Personal Best</h2>

              <button id="resetScoresButton" class="ghost">Reset</button>

            </div>

            <div class="best-score-card">

              <span class="eyebrow">Best Score</span>

              <strong id="bestScoreText">0</strong>

            </div>

            <h2 class="stacked-heading">Recent Runs</h2>

            <ol id="recentRunsList" class="leaderboard-list"></ol>

          </section>

        </aside>

      </main>

    `;

  }



  private mountGame(): void {

    const canvas = this.getElement<HTMLCanvasElement>('gameCanvas');

    this.game = new Game(canvas, {

      onScore: (score) => {

        this.updateScore(score);

        this.pulseHudScore();

        this.sound.play('score');

      },

      onGameOver: (score) => void this.handleGameOver(score),

      onFlap: () => this.sound.play('flap'),

      onHit: () => this.sound.play('hit'),

      onStart: () => this.sound.play('start'),

      onStateChange: (snapshot) => this.updateGameState(snapshot)

    });

    this.game.setTheme(this.selectedTheme);

    this.game.mount();

  }



  private bindEvents(): void {

    const canvas = this.getElement<HTMLCanvasElement>('gameCanvas');

    const cheatToggle = this.getElement<HTMLInputElement>('cheatToggle');

    const agentToggle = this.getElement<HTMLInputElement>('agentToggle');

    const soundToggle = this.getElement<HTMLInputElement>('soundToggle');

    const themeSelect = this.getElement<HTMLSelectElement>('themeSelect');

    const difficultySelect = this.getElement<HTMLSelectElement>('difficultySelect');

    const playerNameInput = this.getElement<HTMLInputElement>('playerNameInput');



    const restartFromOverlay = () => this.game?.restart();



    canvas.addEventListener('pointerdown', () => {
      const game = this.game;

      if (!game) {
        return;
      }

      const status = game.getSnapshot().status;

      if (status === 'running') {
        game.pause();
        return;
      }

      if (status === 'paused') {
        game.resume();
        return;
      }

      if (status === 'ready') {
        game.flap();
        return;
      }

      if (status === 'game-over') {
        restartFromOverlay();
      }
    });



    window.addEventListener('keydown', (event) => {
      const game = this.game;

      if (!game) {
        return;
      }

      const status = game.getSnapshot().status;

      if (event.code === 'KeyP') {
        game.togglePause();
        return;
      }

      if (event.code !== 'Space') {
        return;
      }

      event.preventDefault();

      if (status === 'paused') {
        game.resume();
        return;
      }

      if (status === 'running') {
        if (game.getMode() === 'manual') {
          game.flap();
        } else {
          restartFromOverlay();
        }

        return;
      }

      if (status === 'ready') {
        game.flap();
        return;
      }

      if (status === 'game-over') {
        restartFromOverlay();
      }
    });



    this.getElement<HTMLButtonElement>('startButton').addEventListener('click', () => {

      this.game?.restart();

    });



    this.getElement<HTMLButtonElement>('pauseButton').addEventListener('click', () => {

      this.game?.togglePause();

    });



    this.getElement<HTMLButtonElement>('overlayRestartButton').addEventListener('click', () => {

      restartFromOverlay();

    });



    cheatToggle.addEventListener('change', () => {

      if (cheatToggle.checked) {

        agentToggle.checked = false;

      }



      this.applyPlayMode(cheatToggle, agentToggle);

    });



    agentToggle.addEventListener('change', () => {

      if (agentToggle.checked) {

        cheatToggle.checked = false;

      }



      this.applyPlayMode(cheatToggle, agentToggle);

    });



    soundToggle.addEventListener('change', () => {

      this.sound.setEnabled(soundToggle.checked);

    });



    themeSelect.addEventListener('change', () => {
      this.selectedTheme = getThemeById(themeSelect.value);
      this.updatePageTitle();
      this.game?.setTheme(this.selectedTheme);
    });



    difficultySelect.addEventListener('change', () => {

      this.game?.setDifficulty(difficultySelect.value as DifficultyId);

    });



    playerNameInput.addEventListener('input', () => {

      this.playerName = sanitizePlayerName(playerNameInput.value);

      localStorage.setItem('flappy-player-name', this.playerName);

    });



    this.getElement<HTMLButtonElement>('resetScoresButton').addEventListener('click', () => {

      this.localScores = resetLocalScores();

      this.renderLocalScores();

    });

  }



  private handleGameOver(score: number): void {

    const snapshot = this.game?.getSnapshot();

    this.localScores = saveLocalRun({

      score,

      playerName: this.playerName,

      characterId: this.selectedTheme.character.id,

      mode: snapshot?.mode ?? 'manual',

      difficulty: snapshot?.difficulty ?? 'normal'

    });

    this.renderLocalScores();

    this.getElement<HTMLElement>('gameOverScore').textContent = `Score: ${score}`;

  }



  private updateGameState(snapshot: GameSnapshot): void {

    this.updateScore(snapshot.score);

    this.syncModeToggles(snapshot.mode);

    this.updateModeText(snapshot.mode);

    this.updateOverlays(snapshot);

    this.getElement<HTMLButtonElement>('pauseButton').textContent = snapshot.status === 'paused' ? 'Resume' : 'Pause';



    if (snapshot.status === 'game-over' && this.lastStatus !== 'game-over') {

      this.getElement<HTMLElement>('gameCard').classList.add('game-over-shake');

      window.setTimeout(() => {

        this.getElement<HTMLElement>('gameCard').classList.remove('game-over-shake');

      }, 520);

    }



    this.lastStatus = snapshot.status;

  }



  private updateOverlays(snapshot: GameSnapshot): void {

    const ready = this.getElement<HTMLElement>('screenReady');

    const paused = this.getElement<HTMLElement>('screenPaused');

    const gameOver = this.getElement<HTMLElement>('screenGameOver');

    const hud = this.root.querySelector<HTMLElement>('.hud-overlay');



    ready.classList.toggle('is-hidden', snapshot.status !== 'ready');

    paused.classList.toggle('is-hidden', snapshot.status !== 'paused');

    gameOver.classList.toggle('is-hidden', snapshot.status !== 'game-over');

    hud?.classList.toggle('is-hidden', snapshot.status === 'ready');

  }



  private applyPlayMode(cheatToggle: HTMLInputElement, agentToggle: HTMLInputElement): void {

    const mode: GameMode = cheatToggle.checked ? 'cheat' : agentToggle.checked ? 'agent' : 'manual';

    this.game?.setMode(mode);

    this.updateModeText(mode);

  }



  private syncModeToggles(mode: GameMode): void {

    const resolved: GameMode = (mode as string) === 'ai' ? 'cheat' : mode;

    const cheatToggle = this.root.querySelector<HTMLInputElement>('#cheatToggle');

    const agentToggle = this.root.querySelector<HTMLInputElement>('#agentToggle');



    if (!cheatToggle || !agentToggle) {

      return;

    }



    cheatToggle.checked = resolved === 'cheat';

    agentToggle.checked = resolved === 'agent';

  }



  private updateScore(score: number): void {

    const value = String(score);

    this.getElement<HTMLElement>('scoreText').textContent = value;

    this.getElement<HTMLElement>('hudScore').textContent = value;

  }



  private pulseHudScore(): void {

    const hudScore = this.getElement<HTMLElement>('hudScore');

    hudScore.classList.remove('score-pop');

    void hudScore.offsetWidth;

    hudScore.classList.add('score-pop');

    window.clearTimeout(this.scorePulseTimer);

    this.scorePulseTimer = window.setTimeout(() => hudScore.classList.remove('score-pop'), 360);

  }



  private updatePageTitle(): void {
    const title = this.selectedTheme.name;
    const pageTitle = this.root.querySelector<HTMLElement>('#pageTitle');

    if (pageTitle) {
      pageTitle.textContent = title;
    }

    document.title = title;
  }

  private updateModeText(mode: GameMode): void {

    const labels: Record<GameMode, string> = {

      manual: 'Manual',

      cheat: 'Cheat Mode',

      agent: 'Pro Agent'

    };

    const legacy = (mode as string) === 'ai' ? 'Cheat Mode' : null;

    this.getElement<HTMLElement>('modeText').textContent = legacy ?? labels[mode] ?? 'Manual';

  }



  private renderLocalScores(): void {

    this.getElement<HTMLElement>('bestScoreText').textContent = String(this.localScores.bestScore);

    const list = this.getElement<HTMLOListElement>('recentRunsList');



    if (this.localScores.runs.length === 0) {

      list.innerHTML = '<li class="empty">No runs yet. Play once to save your first score.</li>';

      return;

    }



    list.innerHTML = this.localScores.runs

      .map((run) => {

        const skin = getThemeNameByCharacterId(run.characterId);

        const mode = getModeLabel(run.mode);

        const difficulty = DIFFICULTIES[run.difficulty]?.name ?? run.difficulty;



        return `

          <li>

            <span class="rank-score">${run.score}</span>

            <span>

              <strong>${escapeHtml(run.playerName)}</strong>

              <small>${escapeHtml(skin)} · ${mode} · ${difficulty} · ${escapeHtml(run.createdAt)}</small>

            </span>

          </li>

        `;

      })

      .join('');

  }



  private getElement<T extends HTMLElement>(id: string): T {

    const element = this.root.querySelector<T>(`#${id}`);



    if (!element) {

      throw new Error(`Missing element #${id}`);

    }



    return element;

  }

}



function escapeHtml(value: string): string {

  const div = document.createElement('div');

  div.textContent = value;

  return div.innerHTML;

}



function loadPlayerName(): string {

  const existingName = localStorage.getItem('flappy-player-name');



  if (existingName) {

    return sanitizePlayerName(existingName);

  }



  const generatedName = `Guest ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  localStorage.setItem('flappy-player-name', generatedName);

  return generatedName;

}



function sanitizePlayerName(value: string): string {

  return value.replace(/[^\w\sก-๙.-]/g, '').trim().slice(0, 24) || 'Guest Player';

}


