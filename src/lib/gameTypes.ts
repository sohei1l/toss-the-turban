// Game State Machine
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  TURBAN_TOSSED = 'TURBAN_TOSSED', // Celebration state
  GAMEOVER = 'GAMEOVER',
}

// Mullah Behavior FSM
export enum MullahState {
  WALKING = 'WALKING',
  TURNING = 'TURNING',
  LOOKING_BACK = 'LOOKING_BACK',
}

// Entity interfaces
export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  walkFrame: number; // Animation frame for walking
}

export interface Hat {
  x: number;
  y: number;
  width: number;
  height: number;
  attached: boolean;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
}

export interface Mullah {
  x: number;
  y: number;
  width: number;
  height: number;
  state: MullahState;
  stateTimer: number;
  walkDuration: number;
  turningDuration: number;
  lookBackDuration: number;
  turban: Hat;
  walkFrame: number; // Animation frame for walking
  turnProgress: number; // 0-1 for smooth turning animation
  facingPlayer: boolean; // true when looking at player
  currentSpeed: number; // Current walking speed (randomized)
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  groundY: number;
  gravity: number;
  jumpForce: number;
  baseMullahSpeed: number;
  maxMullahSpeed: number;
  minMullahSpeed: number;
  basePlayerSpeed: number;
  baseDetectionDistance: number;
  baseHitDistance: number;
  minDetectionDistance: number;
  minHitDistance: number;
  baseWalkDuration: number;
  minWalkDuration: number;
  maxWalkDuration: number;
  baseTurningDuration: number;
  minTurningDuration: number;
  maxTurningDuration: number;
  baseLookBackDuration: number;
  minLookBackDuration: number;
  maxLookBackDuration: number;
  safeStartDistance: number;
  turbanTossedDuration: number; // How long to show celebration
}

export interface GameData {
  state: GameState;
  score: number;
  highScore: number;
  difficulty: number;
  player: Player;
  mullah: Mullah;
  scrollOffset: number;
  mullahSpeed: number;
  detectionDistance: number;
  hitDistance: number;
  celebrationTimer: number; // Timer for turban tossed celebration
  bustedIntensity: number; // For flashing effect on busted
}

// Default game configuration
export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 800,
  canvasHeight: 400,
  groundY: 320,
  gravity: 0.6,
  jumpForce: -12,
  baseMullahSpeed: 2.0,
  maxMullahSpeed: 3.5,
  minMullahSpeed: 1.2,
  basePlayerSpeed: 1.5,
  baseDetectionDistance: 100,
  baseHitDistance: 90,
  minDetectionDistance: 50,
  minHitDistance: 45,
  // Walk duration - randomized each cycle
  baseWalkDuration: 150,
  minWalkDuration: 80, // Can be very short - unpredictable!
  maxWalkDuration: 250, // Can be long
  // Turning duration - randomized
  baseTurningDuration: 50,
  minTurningDuration: 25, // Quick turn
  maxTurningDuration: 80, // Slow suspicious turn
  // Look back duration - randomized
  baseLookBackDuration: 70,
  minLookBackDuration: 40, // Quick glance
  maxLookBackDuration: 120, // Long stare
  safeStartDistance: 200,
  turbanTossedDuration: 120, // 2 seconds celebration
};

// Hat configuration - Mullah turban style - sized to sit on top of head
export const HAT_CONFIG = {
  width: 50,
  height: 35,
};
