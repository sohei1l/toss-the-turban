import {
  GameState,
  MullahState,
  GameData,
  GameConfig,
  Player,
  Mullah,
  Hat,
  DEFAULT_CONFIG,
  HAT_CONFIG,
} from './gameTypes';

export class GameEngine {
  private config: GameConfig;
  private data: GameData;
  private animatingTurbans: Hat[] = [];
  private lostByMiss: boolean = false;

  constructor(config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.data = this.createInitialGameData();
  }

  private createInitialGameData(): GameData {
    const highScore = typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('turbanFlipperHighScore') || '0', 10)
      : 0;

    return {
      state: GameState.START,
      score: 0,
      highScore,
      difficulty: 0,
      player: this.createPlayer(),
      mullah: this.createMullah(),
      scrollOffset: 0,
      mullahSpeed: this.config.baseMullahSpeed,
      detectionDistance: this.config.baseDetectionDistance,
      hitDistance: this.config.baseHitDistance,
      celebrationTimer: 0,
      bustedIntensity: 0,
    };
  }

  private createPlayer(): Player {
    return {
      x: 100,
      y: this.config.groundY - 60,
      width: 40,
      height: 60,
      velocityY: 0,
      isJumping: false,
      walkFrame: 0,
    };
  }

  private createMullah(): Mullah {
    return {
      x: 100 + this.config.safeStartDistance,
      y: this.config.groundY - 80,
      width: 60,
      height: 80,
      state: MullahState.WALKING,
      stateTimer: this.getRandomWalkDuration(),
      walkDuration: this.config.baseWalkDuration,
      turningDuration: this.config.baseTurningDuration,
      lookBackDuration: this.config.baseLookBackDuration,
      turban: this.createTurban(),
      walkFrame: 0,
      turnProgress: 0,
      facingPlayer: false,
      currentSpeed: this.getRandomMullahSpeed(),
    };
  }

  private createTurban(): Hat {
    return {
      x: 0,
      y: 0,
      width: HAT_CONFIG.width,
      height: HAT_CONFIG.height,
      attached: true,
      velocityX: 0,
      velocityY: 0,
      rotation: 0,
      rotationSpeed: 0,
    };
  }

  // Randomization functions for unpredictable mullah behavior
  private getRandomMullahSpeed(): number {
    const min = this.config.minMullahSpeed;
    const max = Math.min(
      this.config.maxMullahSpeed,
      this.config.baseMullahSpeed + this.data?.difficulty * 0.15 || this.config.baseMullahSpeed
    );
    return min + Math.random() * (max - min);
  }

  private getRandomWalkDuration(): number {
    const difficultyReduction = (this.data?.difficulty || 0) * 5;
    const min = Math.max(this.config.minWalkDuration, this.config.minWalkDuration - difficultyReduction * 0.3);
    const max = Math.max(min + 30, this.config.maxWalkDuration - difficultyReduction);
    return min + Math.random() * (max - min);
  }

  private getRandomTurningDuration(): number {
    const min = this.config.minTurningDuration;
    const max = this.config.maxTurningDuration;
    return min + Math.random() * (max - min);
  }

  private getRandomLookBackDuration(): number {
    const difficultyIncrease = (this.data?.difficulty || 0) * 3;
    const min = this.config.minLookBackDuration;
    const max = Math.min(this.config.maxLookBackDuration + difficultyIncrease, 180);
    return min + Math.random() * (max - min);
  }

  public getData(): GameData {
    return this.data;
  }

  public getConfig(): GameConfig {
    return this.config;
  }

  public getAnimatingTurbans(): Hat[] {
    return this.animatingTurbans;
  }

  public getLostByMiss(): boolean {
    return this.lostByMiss;
  }

  public startGame(): void {
    this.data = this.createInitialGameData();
    this.data.state = GameState.PLAYING;
    this.animatingTurbans = [];
    this.lostByMiss = false;
  }

  public restartGame(): void {
    const highScore = this.data.highScore;
    this.data = this.createInitialGameData();
    this.data.highScore = highScore;
    this.data.state = GameState.PLAYING;
    this.animatingTurbans = [];
    this.lostByMiss = false;
  }

  public jump(): void {
    if (this.data.state !== GameState.PLAYING) return;

    const player = this.data.player;
    if (!player.isJumping) {
      player.velocityY = this.config.jumpForce;
      player.isJumping = true;
    }
  }

  public handleInput(): void {
    switch (this.data.state) {
      case GameState.START:
        this.startGame();
        break;
      case GameState.PLAYING:
        this.jump();
        break;
      case GameState.TURBAN_TOSSED:
        // Ignore input during celebration
        break;
      case GameState.GAMEOVER:
        this.restartGame();
        break;
    }
  }

  public update(): void {
    // Handle celebration state
    if (this.data.state === GameState.TURBAN_TOSSED) {
      this.updateCelebration();
      this.updateAnimatingTurbans();
      return;
    }

    // Handle game over effects
    if (this.data.state === GameState.GAMEOVER) {
      this.data.bustedIntensity = Math.sin(Date.now() / 100) * 0.5 + 0.5;
      return;
    }

    if (this.data.state !== GameState.PLAYING) return;

    this.updatePlayer();
    this.updateMullah();
    this.updateAnimatingTurbans();
    this.checkCollisions();
    this.updateScroll();
  }

  private updateCelebration(): void {
    this.data.celebrationTimer--;

    if (this.data.celebrationTimer <= 0) {
      this.continueAfterCelebration();
    }
  }

  private continueAfterCelebration(): void {
    this.data.state = GameState.PLAYING;
    this.data.celebrationTimer = 0;

    // Reset player position relative to mullah
    this.data.player.x = this.data.mullah.x - this.config.safeStartDistance;
    this.data.player.y = this.config.groundY - this.data.player.height;
    this.data.player.velocityY = 0;
    this.data.player.isJumping = false;

    // Reset mullah state with new turban and RANDOMIZED behavior
    this.data.mullah.state = MullahState.WALKING;
    this.data.mullah.stateTimer = this.getRandomWalkDuration();
    this.data.mullah.turnProgress = 0;
    this.data.mullah.facingPlayer = false;
    this.data.mullah.turban = this.createTurban();
    this.data.mullah.currentSpeed = this.getRandomMullahSpeed(); // New random speed!
  }

  private updatePlayer(): void {
    const player = this.data.player;
    const mullah = this.data.mullah;
    const groundLevel = this.config.groundY - player.height;

    // Apply gravity
    player.velocityY += this.config.gravity;
    player.y += player.velocityY;

    // Ground collision
    if (player.y >= groundLevel) {
      player.y = groundLevel;
      player.velocityY = 0;
      player.isJumping = false;
    }

    // Player movement
    const distanceToMullah = mullah.x - player.x;

    let playerSpeed = this.config.basePlayerSpeed;

    // Speed up when far
    if (distanceToMullah > 250) {
      playerSpeed = this.config.basePlayerSpeed * 1.5;
    }

    // Slow down when mullah is looking or turning
    if (mullah.state === MullahState.LOOKING_BACK || mullah.state === MullahState.TURNING) {
      playerSpeed = this.config.basePlayerSpeed * 0.3;
    }

    // Lunge forward when jumping
    if (player.isJumping && player.velocityY < 0) {
      playerSpeed = mullah.currentSpeed + 3;
    }

    player.x += playerSpeed;

    // Update walk animation
    if (!player.isJumping) {
      player.walkFrame += 0.15;
    }
  }

  private updateMullah(): void {
    const mullah = this.data.mullah;

    // Mullah moves at their current randomized speed
    mullah.x += mullah.currentSpeed;

    // Update walk animation
    mullah.walkFrame += 0.12;

    // Update state machine timer
    mullah.stateTimer--;

    // Smooth turn animation
    if (mullah.state === MullahState.TURNING) {
      mullah.turnProgress = Math.min(1, mullah.turnProgress + 0.05);
    } else if (mullah.state === MullahState.LOOKING_BACK) {
      mullah.turnProgress = 1;
      mullah.facingPlayer = true;
    } else {
      mullah.turnProgress = Math.max(0, mullah.turnProgress - 0.08);
      if (mullah.turnProgress === 0) {
        mullah.facingPlayer = false;
      }
    }

    // State transitions with RANDOMIZED timings
    if (mullah.stateTimer <= 0) {
      switch (mullah.state) {
        case MullahState.WALKING:
          mullah.state = MullahState.TURNING;
          mullah.stateTimer = this.getRandomTurningDuration();
          break;
        case MullahState.TURNING:
          mullah.state = MullahState.LOOKING_BACK;
          mullah.stateTimer = this.getRandomLookBackDuration();
          break;
        case MullahState.LOOKING_BACK:
          mullah.state = MullahState.WALKING;
          mullah.stateTimer = this.getRandomWalkDuration();
          // Randomize speed when starting to walk again!
          mullah.currentSpeed = this.getRandomMullahSpeed();
          break;
      }
    }

    // Update attached turban position
    if (mullah.turban.attached) {
      mullah.turban.x = mullah.x + mullah.width / 2 - mullah.turban.width / 2;
      mullah.turban.y = mullah.y - 60;
    }
  }

  private updateAnimatingTurbans(): void {
    for (let i = this.animatingTurbans.length - 1; i >= 0; i--) {
      const turban = this.animatingTurbans[i];

      turban.velocityY += this.config.gravity * 0.3;
      turban.x += turban.velocityX;
      turban.y += turban.velocityY;
      turban.rotation += turban.rotationSpeed;

      if (turban.y > this.config.canvasHeight + 100) {
        this.animatingTurbans.splice(i, 1);
      }
    }
  }

  private checkCollisions(): void {
    const player = this.data.player;
    const mullah = this.data.mullah;
    const distanceToMullah = mullah.x - player.x;

    // BUSTED: Mullah looking back and player too close
    if (mullah.state === MullahState.LOOKING_BACK &&
        distanceToMullah < this.data.detectionDistance &&
        distanceToMullah > 0) {
      this.lostByMiss = false;
      this.gameOver();
      return;
    }

    // TURBAN FLIP: Player jumping, mullah walking, within range
    if (player.isJumping &&
        mullah.state === MullahState.WALKING &&
        mullah.turban.attached &&
        distanceToMullah < this.data.hitDistance &&
        distanceToMullah > 20) {

      const handReachX = player.x + player.width + 30;
      const handReachY = player.y + 15;
      const turbanCenterX = mullah.turban.x + mullah.turban.width / 2;
      const turbanCenterY = mullah.turban.y + mullah.turban.height / 2;

      const reachDistance = Math.sqrt(
        Math.pow(handReachX - turbanCenterX, 2) +
        Math.pow(handReachY - turbanCenterY, 2)
      );

      if (reachDistance < 60) {
        this.scoreHit();
      }
    }
  }

  private scoreHit(): void {
    const mullah = this.data.mullah;

    // Create flying turban with dramatic physics
    const flyingTurban: Hat = {
      ...mullah.turban,
      attached: false,
      velocityX: 5 + Math.random() * 4,
      velocityY: -12 - Math.random() * 6,
      rotationSpeed: 0.2 + Math.random() * 0.3,
    };
    this.animatingTurbans.push(flyingTurban);

    mullah.turban.attached = false;

    // Update score
    this.data.score++;
    this.data.difficulty++;

    // Update high score
    if (this.data.score > this.data.highScore) {
      this.data.highScore = this.data.score;
      if (typeof window !== 'undefined') {
        localStorage.setItem('turbanFlipperHighScore', this.data.highScore.toString());
      }
    }

    // Increase difficulty - affects randomization ranges
    this.data.mullahSpeed = Math.min(
      this.config.baseMullahSpeed + this.data.difficulty * 0.15,
      this.config.maxMullahSpeed
    );

    this.data.detectionDistance = Math.max(
      this.config.minDetectionDistance,
      this.config.baseDetectionDistance - this.data.difficulty * 3
    );

    this.data.hitDistance = Math.max(
      this.config.minHitDistance,
      this.config.baseHitDistance - this.data.difficulty * 2
    );

    // Enter celebration state
    this.data.state = GameState.TURBAN_TOSSED;
    this.data.celebrationTimer = this.config.turbanTossedDuration;
  }

  private gameOver(): void {
    this.data.state = GameState.GAMEOVER;
    this.data.bustedIntensity = 1;
  }

  private updateScroll(): void {
    const player = this.data.player;
    const mullah = this.data.mullah;

    const playerLeftMargin = 80;
    const mullahRightMargin = 150;

    const minScroll = player.x - playerLeftMargin;
    const maxScroll = mullah.x - (this.config.canvasWidth - mullahRightMargin);

    let targetScroll = (player.x + mullah.x) / 2 - this.config.canvasWidth / 2;
    targetScroll = Math.max(minScroll, Math.min(maxScroll, targetScroll));

    this.data.scrollOffset += (targetScroll - this.data.scrollOffset) * 0.12;
  }
}
