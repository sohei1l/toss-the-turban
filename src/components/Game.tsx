'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '@/lib/gameEngine';
import { GameState, MullahState, Hat, Mullah } from '@/lib/gameTypes';

// Target 60 FPS with delta time for consistent speed across devices
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const confettiRef = useRef<Array<{x: number, y: number, vx: number, vy: number, color: string, size: number}>>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, engine: GameEngine, frameCount: number) => {
    const config = engine.getConfig();
    const data = engine.getData();
    const scrollOffset = data.scrollOffset;

    // Clear canvas - bathhouse/spa background
    ctx.fillStyle = '#E8DCC8';
    ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);

    // Draw steam/mist in background - simplified for mobile performance
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 3; i++) {
      const steamX = ((i * 280 - scrollOffset * 0.1) % (config.canvasWidth + 100)) - 50;
      const steamY = 70 + Math.sin(frameCount * 0.02 + i) * 15;
      ctx.beginPath();
      ctx.arc(steamX, steamY, 45, 0, Math.PI * 2);
      ctx.arc(steamX + 60, steamY - 10, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw tiled floor
    ctx.fillStyle = '#C9B896';
    ctx.fillRect(0, config.groundY, config.canvasWidth, config.canvasHeight - config.groundY);

    // Draw tile pattern - batch into single path
    ctx.strokeStyle = '#A89878';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < config.canvasWidth + 80; i += 80) {
      const lineX = i - (scrollOffset % 80);
      ctx.moveTo(lineX, config.groundY);
      ctx.lineTo(lineX, config.canvasHeight);
    }
    ctx.moveTo(0, config.groundY + 40);
    ctx.lineTo(config.canvasWidth, config.groundY + 40);
    ctx.stroke();

    if (data.state === GameState.PLAYING || data.state === GameState.GAMEOVER || data.state === GameState.TURBAN_TOSSED) {
      const player = data.player;
      const mullah = data.mullah;
      const playerScreenX = player.x - scrollOffset;
      const mullahScreenX = mullah.x - scrollOffset;
      const distanceToMullah = mullah.x - player.x;

      // Calculate attack opportunity
      const inAttackRange = distanceToMullah < data.hitDistance && distanceToMullah > 20;
      const canAttack = mullah.state === MullahState.WALKING && inAttackRange;

      // Draw danger zone indicator when mullah is turning or looking
      if (mullah.state === MullahState.LOOKING_BACK || mullah.state === MullahState.TURNING) {
        const dangerAlpha = mullah.state === MullahState.LOOKING_BACK ? 0.3 : 0.15;
        ctx.fillStyle = `rgba(255, 0, 0, ${dangerAlpha})`;
        ctx.fillRect(
          mullahScreenX - data.detectionDistance - 20,
          0,
          data.detectionDistance + 40,
          config.groundY
        );
      }

      // Draw safe attack zone when walking
      if (mullah.state === MullahState.WALKING) {
        ctx.fillStyle = 'rgba(0, 200, 0, 0.1)';
        ctx.fillRect(
          mullahScreenX - data.hitDistance,
          config.groundY - 120,
          data.hitDistance - 20,
          120
        );
      }

      // Draw mullah with animations
      drawMullah(ctx, mullahScreenX, mullah.y, mullah.width, mullah.height, mullah, frameCount);

      // Draw turban on mullah's head (if attached)
      if (mullah.turban.attached) {
        drawTurban(ctx, mullah.turban.x - scrollOffset + mullah.turban.width / 2, mullah.turban.y + mullah.turban.height / 2, mullah.turban.width, mullah.turban.height, 0);
      }

      // Draw player
      drawPlayer(ctx, playerScreenX, player.y, player.width, player.height, player.isJumping, canAttack, player.walkFrame, frameCount);

      // Draw animating turbans
      const animatingTurbans = engine.getAnimatingTurbans();
      for (const turban of animatingTurbans) {
        drawTurban(ctx, turban.x - scrollOffset, turban.y, turban.width, turban.height, turban.rotation);
      }

      // Draw HUD
      drawHUD(ctx, config.canvasWidth, data.score, data.highScore, data.difficulty, mullah.state, distanceToMullah, data.hitDistance);
    }

    // Draw overlays
    if (data.state === GameState.START) {
      drawStartOverlay(ctx, config.canvasWidth, config.canvasHeight, frameCount);
    } else if (data.state === GameState.TURBAN_TOSSED) {
      drawTurbanFlippedOverlay(ctx, config.canvasWidth, config.canvasHeight, data.score, data.celebrationTimer, confettiRef.current, frameCount);
      updateConfetti(confettiRef.current, config.canvasWidth, config.canvasHeight);
    } else if (data.state === GameState.GAMEOVER) {
      drawBustedOverlay(ctx, config.canvasWidth, config.canvasHeight, data.score, data.highScore, data.bustedIntensity, frameCount);
    }
  }, []);

  function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isJumping: boolean, canAttack: boolean, walkFrame: number, frameCount: number) {
    const bobY = isJumping ? 0 : Math.sin(walkFrame) * 2;
    const adjustedY = y + bobY;

    // Legs with walking animation - jeans
    ctx.fillStyle = '#4A6FA5';
    const legOffset = isJumping ? 5 : Math.sin(walkFrame) * 8;
    // Left leg
    ctx.fillRect(x + 10, adjustedY + height - 22, 9, 22);
    // Right leg
    ctx.fillRect(x + width - 19, adjustedY + height - 22 + (isJumping ? -5 : legOffset * 0.5), 9, 22);

    // Shoes
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 8, adjustedY + height - 4, 13, 4);
    ctx.fillRect(x + width - 21, adjustedY + height - 4 + (isJumping ? -5 : legOffset * 0.5), 13, 4);

    // Body - casual t-shirt
    ctx.fillStyle = '#48C9B0';
    ctx.beginPath();
    ctx.roundRect(x + 5, adjustedY + 18, width - 10, height - 40, 5);
    ctx.fill();

    // T-shirt collar
    ctx.fillStyle = '#3498DB';
    ctx.beginPath();
    ctx.arc(x + width / 2, adjustedY + 20, 8, 0, Math.PI);
    ctx.fill();

    // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(x + width / 2, adjustedY + 8, 15, 0, Math.PI * 2);
    ctx.fill();

    // Hair - messy young person hair
    ctx.fillStyle = '#4A3728';
    ctx.beginPath();
    // Top hair
    ctx.ellipse(x + width / 2, adjustedY - 2, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Side hair tufts
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 12, adjustedY + 2);
    ctx.quadraticCurveTo(x + width / 2 - 18, adjustedY - 5, x + width / 2 - 10, adjustedY - 8);
    ctx.quadraticCurveTo(x + width / 2 - 5, adjustedY - 3, x + width / 2, adjustedY - 5);
    ctx.fill();
    // Hair on right side
    ctx.beginPath();
    ctx.moveTo(x + width / 2 + 12, adjustedY + 2);
    ctx.quadraticCurveTo(x + width / 2 + 16, adjustedY - 3, x + width / 2 + 8, adjustedY - 6);
    ctx.fill();

    // Happy face - looking right
    // Eyes - bright and lively
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.ellipse(x + width / 2 + 4, adjustedY + 5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2C3E50';
    ctx.beginPath();
    ctx.arc(x + width / 2 + 5, adjustedY + 5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Eye sparkle
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x + width / 2 + 6, adjustedY + 4, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Friendly eyebrow
    ctx.strokeStyle = '#4A3728';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + width / 2 + 1, adjustedY + 0);
    ctx.quadraticCurveTo(x + width / 2 + 5, adjustedY - 2, x + width / 2 + 9, adjustedY + 1);
    ctx.stroke();

    // Big happy smile
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + width / 2 + 3, adjustedY + 10, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Rosy cheek
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.beginPath();
    ctx.arc(x + width / 2 + 10, adjustedY + 9, 3, 0, Math.PI * 2);
    ctx.fill();

    // Small nose
    ctx.fillStyle = '#E8B89D';
    ctx.beginPath();
    ctx.arc(x + width / 2 + 6, adjustedY + 7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.ellipse(x + width / 2 - 14, adjustedY + 6, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arm reaching out
    const armExtension = isJumping ? 35 : (canAttack ? 25 : 12);
    const armY = adjustedY + 30;
    const armEndY = armY - (isJumping ? 20 : 8);

    // Arm - skin tone
    ctx.strokeStyle = '#FFDAB9';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + width - 5, armY);
    ctx.quadraticCurveTo(x + width + armExtension * 0.6, armY - 5, x + width + armExtension, armEndY);
    ctx.stroke();

    // Hand
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(x + width + armExtension, armEndY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Fingers
    ctx.strokeStyle = '#FFDAB9';
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + width + armExtension + 4, armEndY + i * 3);
      ctx.lineTo(x + width + armExtension + 10, armEndY - 3 + i * 2);
      ctx.stroke();
    }

    // Glow when can attack
    if (canAttack) {
      ctx.strokeStyle = 'rgba(50, 255, 50, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + width + armExtension, armEndY, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Pulsing effect
      const pulse = Math.sin(frameCount * 0.15) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(50, 255, 50, ${pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + width + armExtension, armEndY, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMullah(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, mullah: Mullah, frameCount: number) {
    const walkFrame = mullah.walkFrame;
    const turnProgress = mullah.turnProgress;
    const isLooking = mullah.facingPlayer;
    const isWarning = mullah.state === MullahState.TURNING;

    // Walking bob
    const bobY = Math.sin(walkFrame) * 3;
    const adjustedY = y + bobY;

    // Long flowing robe/gown (qaba style) - light brown/tan color
    ctx.fillStyle = '#A67C52';

    // Main robe body - long flowing shape
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 35, adjustedY + 10);
    ctx.quadraticCurveTo(x + width / 2 - 45, adjustedY + height / 2, x + width / 2 - 40, adjustedY + height + 15);
    ctx.lineTo(x + width / 2 + 40, adjustedY + height + 15);
    ctx.quadraticCurveTo(x + width / 2 + 45, adjustedY + height / 2, x + width / 2 + 35, adjustedY + 10);
    ctx.closePath();
    ctx.fill();

    // Robe movement with walking
    const robeSwing = Math.sin(walkFrame) * 3;
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 30, adjustedY + height - 10);
    ctx.quadraticCurveTo(x + width / 2 + robeSwing, adjustedY + height + 5, x + width / 2 + 30, adjustedY + height - 10);
    ctx.lineTo(x + width / 2 + 35, adjustedY + height + 15);
    ctx.lineTo(x + width / 2 - 35, adjustedY + height + 15);
    ctx.closePath();
    ctx.fill();

    // Aba (cloak) over shoulders - slightly darker brown
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, adjustedY + 25, 38, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Robe collar/neckline
    ctx.fillStyle = '#9C8B75';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, adjustedY + 8, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Robe vertical line (button line)
    ctx.strokeStyle = '#6B5344';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, adjustedY + 15);
    ctx.lineTo(x + width / 2, adjustedY + height);
    ctx.stroke();

    // Head
    ctx.save();
    ctx.translate(x + width / 2, adjustedY - 15);

    // Head base
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.arc(0, 5, 24, 0, Math.PI * 2);
    ctx.fill();

    // Beard - big and WHITE
    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath();
    ctx.moveTo(-18, 10);
    ctx.quadraticCurveTo(-22, 25, -15, 40);
    ctx.quadraticCurveTo(0, 48, 15, 40);
    ctx.quadraticCurveTo(22, 25, 18, 10);
    ctx.quadraticCurveTo(0, 18, -18, 10);
    ctx.fill();

    // Beard texture - gray lines on white
    ctx.strokeStyle = '#D0D0D0';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 15);
      ctx.quadraticCurveTo(i + 2, 30, i, 38);
      ctx.stroke();
    }

    // Ears (visible from behind and side)
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.ellipse(-24, 5, 6, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(24, 5, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // ALWAYS show face - but direction changes based on state
    // When walking forward: face looks right (away from player) - SAFE
    // When looking back: face looks left (at player) - DANGER

    // Big nose - always visible
    ctx.fillStyle = '#C9A66B';
    ctx.beginPath();
    if (isLooking) {
      // Nose pointing left (at player)
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(-6, 4, -4, 10);
      ctx.quadraticCurveTo(0, 12, 4, 10);
      ctx.quadraticCurveTo(6, 4, 0, -2);
    } else {
      // Nose pointing right (away from player)
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(6, 4, 4, 10);
      ctx.quadraticCurveTo(0, 12, -4, 10);
      ctx.quadraticCurveTo(-6, 4, 0, -2);
    }
    ctx.fill();

    if (isLooking) {
      // LOOKING AT PLAYER - DANGER! Face turned left, angry expression
      // Angry red tint
      ctx.fillStyle = 'rgba(200, 50, 50, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 5, 24, 0, Math.PI * 2);
      ctx.fill();

      // Angry eyes - looking LEFT at player
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(-8, 0, 6, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(6, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark pupils - glaring left
      ctx.fillStyle = '#000';
      const eyeShift = Math.sin(frameCount * 0.08) * 1.5;
      ctx.beginPath();
      ctx.arc(-10 + eyeShift, 0, 3, 0, Math.PI * 2);
      ctx.arc(4 + eyeShift, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Very angry eyebrows - slanted DOWN toward center
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(-4, -4);
      ctx.moveTo(14, -8);
      ctx.lineTo(2, -4);
      ctx.stroke();

      // Furrowed brow wrinkles
      ctx.strokeStyle = '#C4A574';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -14);
      ctx.lineTo(4, -14);
      ctx.moveTo(-4, -16);
      ctx.lineTo(2, -16);
      ctx.stroke();

      // Angry frown
      ctx.strokeStyle = '#8B0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, 14, 6, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();

    } else if (isWarning) {
      // TURNING - suspicious, starting to look back
      // Eyes starting to shift left
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(6 - turnProgress * 8, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(14 - turnProgress * 6, 0, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(5 - turnProgress * 10, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(13 - turnProgress * 8, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Suspicious eyebrows - one raised
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2 - turnProgress * 10, -10);
      ctx.lineTo(12 - turnProgress * 8, -6);
      ctx.moveTo(10 - turnProgress * 4, -12);
      ctx.lineTo(18 - turnProgress * 4, -9);
      ctx.stroke();

      // Slight frown
      ctx.strokeStyle = '#996666';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(8 - turnProgress * 6, 14, 5, Math.PI * 0.9, Math.PI * 0.1, true);
      ctx.stroke();

    } else {
      // WALKING FORWARD - face looking RIGHT (away from player) - SAFE
      // Normal eyes looking right
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(8, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(16, 0, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils looking right
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(10, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(17, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Normal eyebrows - slightly stern but not angry
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, -8);
      ctx.lineTo(14, -6);
      ctx.moveTo(12, -9);
      ctx.lineTo(20, -7);
      ctx.stroke();

      // Neutral/slight frown mouth
      ctx.strokeStyle = '#997777';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6, 14);
      ctx.lineTo(14, 14);
      ctx.stroke();
    }

    ctx.restore();

    // Warning indicator
    if (isWarning) {
      ctx.fillStyle = '#FF4400';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('?!', x + width / 2, adjustedY - 75);

      // Warning rings
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.lineWidth = 3;
      const ringSize = 30 + Math.sin(frameCount * 0.15) * 5;
      ctx.beginPath();
      ctx.arc(x + width / 2, adjustedY - 20, ringSize, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = 'left';
    }

    // Danger indicator when looking
    if (isLooking) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('!!!', x + width / 2, adjustedY - 80);

      // Danger pulse
      const pulse = Math.sin(frameCount * 0.2) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + width / 2, adjustedY - 20, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = 'left';
    }
  }

  function drawTurban(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, rotation: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(3, 6, width / 2.2, height / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turban base (ammameh style) - WHITE - more compact shape
    ctx.fillStyle = '#FFFFFF';

    // Main turban body - more rounded, less tall
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turban top - slight dome
    ctx.beginPath();
    ctx.ellipse(0, -height / 5, width / 2.5, height / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turban wrap layers - subtle texture
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -height / 8, width / 2.5, height / 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, height / 10, width / 2.3, height / 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Diagonal wrap pattern
    ctx.strokeStyle = '#D8D8D8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-width / 4, -height / 4);
    ctx.quadraticCurveTo(0, -height / 8, width / 4, -height / 5);
    ctx.stroke();

    // Small turban tail/end hanging
    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath();
    ctx.moveTo(width / 4, -height / 6);
    ctx.quadraticCurveTo(width / 3 + 5, height / 8, width / 4, height / 3);
    ctx.quadraticCurveTo(width / 6, height / 5, width / 4, -height / 6);
    ctx.fill();

    // Highlight on top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(-width / 6, -height / 4, width / 6, height / 10, -0.3, 0, Math.PI);
    ctx.fill();

    // Subtle border for definition
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2.8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, canvasWidth: number, score: number, highScore: number, difficulty: number, mullahState: MullahState, distance: number, hitDistance: number) {
    // Score panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(10, 10, 140, 75, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${score}`, 25, 42);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`Best: ${highScore}`, 25, 62);
    ctx.fillText(`Level ${difficulty + 1}`, 25, 78);

    // Status panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(canvasWidth - 200, 10, 190, 70, 8);
    ctx.fill();

    if (mullahState === MullahState.LOOKING_BACK) {
      // DANGER
      ctx.fillStyle = '#FF3333';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('FREEZE!', canvasWidth - 185, 38);
      ctx.font = '13px Arial';
      ctx.fillStyle = '#FF9999';
      ctx.fillText('Mullah is looking at you!', canvasWidth - 185, 58);
    } else if (mullahState === MullahState.TURNING) {
      // WARNING
      ctx.fillStyle = '#FFAA00';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('WARNING!', canvasWidth - 185, 38);
      ctx.font = '13px Arial';
      ctx.fillStyle = '#FFCC66';
      ctx.fillText('Mullah is turning around...', canvasWidth - 185, 58);
    } else if (distance < hitDistance && distance > 20) {
      // CAN ATTACK
      ctx.fillStyle = '#33FF33';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('JUMP NOW!', canvasWidth - 185, 38);
      ctx.font = '13px Arial';
      ctx.fillStyle = '#99FF99';
      ctx.fillText('Press SPACE to toss turban!', canvasWidth - 185, 58);
    } else {
      // APPROACH
      ctx.fillStyle = '#AAAAAA';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('Sneaking...', canvasWidth - 185, 38);
      ctx.font = '13px Arial';
      ctx.fillStyle = '#888888';
      ctx.fillText('Get closer to the mullah', canvasWidth - 185, 58);
    }
  }

  function drawStartOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, frameCount: number) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';

    // Title with glow - reduced shadow for mobile performance
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('TOSS THE TURBAN', width / 2, height / 2 - 100);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#E8DCC8';
    ctx.font = '22px Arial';
    ctx.fillText('Sneak up and toss that turban!', width / 2, height / 2 - 55);

    // Instructions
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '16px Arial';
    ctx.fillText('Wait until mullah looks away (face pointing right)', width / 2, height / 2 - 10);
    ctx.fillText('Jump when you see "JUMP NOW!" to toss the turban', width / 2, height / 2 + 15);
    ctx.fillText('If mullah turns and sees you - BUSTED!', width / 2, height / 2 + 40);

    // Start prompt
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px Arial';
    const pulse = Math.sin(frameCount * 0.05) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE or Click to Start', width / 2, height / 2 + 100);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
  }

  function spawnConfetti(confetti: typeof confettiRef.current, width: number) {
    // Reduced confetti for mobile performance (max 50 instead of 100, spawn 4 instead of 8)
    if (confetti.length < 50) {
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
      for (let i = 0; i < 4; i++) {
        confetti.push({
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: 150,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 8 - 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
        });
      }
    }
  }

  function updateConfetti(confetti: typeof confettiRef.current, width: number, height: number) {
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.vy += 0.2;
      c.x += c.vx;
      c.y += c.vy;
      c.vx *= 0.99;

      if (c.y > height + 20) {
        confetti.splice(i, 1);
      }
    }
  }

  function drawTurbanFlippedOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, score: number, timer: number, confetti: typeof confettiRef.current, frameCount: number) {
    // Spawn confetti - reduced for mobile
    spawnConfetti(confetti, width);

    // Draw confetti - simplified (no save/restore per piece)
    for (const c of confetti) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size * 0.6);
    }

    // Semi-transparent celebration overlay
    ctx.fillStyle = 'rgba(0, 50, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';

    // TURBAN TOSSED text with effects - reduced shadow for mobile
    const scale = 1 + Math.sin(frameCount * 0.15) * 0.05;
    ctx.save();
    ctx.translate(width / 2, height / 2 - 40);
    ctx.scale(scale, scale);

    // Glow - reduced blur for mobile
    ctx.shadowColor = '#00FF00';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 52px Arial';
    ctx.fillText('TURBAN TOSSED!', 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();

    // Score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`Score: ${score}`, width / 2, height / 2 + 30);

    // Plus one animation
    const fadeOut = timer / 120;
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('+1', width / 2 + 100, height / 2 + 30 - (120 - timer) * 0.5);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
  }

  function drawBustedOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, score: number, highScore: number, intensity: number, frameCount: number) {
    // Flashing red overlay
    ctx.fillStyle = `rgba(100, 0, 0, ${0.7 + intensity * 0.2})`;
    ctx.fillRect(0, 0, width, height);

    // Red bars (GTA style)
    ctx.fillStyle = `rgba(180, 0, 0, ${0.8 + intensity * 0.2})`;
    ctx.fillRect(0, height / 2 - 80, width, 160);

    // Inner darker bar
    ctx.fillStyle = `rgba(80, 0, 0, 0.9)`;
    ctx.fillRect(0, height / 2 - 50, width, 100);

    ctx.textAlign = 'center';

    // BUSTED text - GTA style - reduced shadow for mobile
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Text shake based on intensity - use frameCount for deterministic shake
    const shakeX = Math.sin(frameCount * 0.5) * intensity * 3;
    const shakeY = Math.cos(frameCount * 0.5) * intensity * 3;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px Arial';
    ctx.fillText('BUSTED', width / 2 + shakeX, height / 2 + 15 + shakeY);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Subtitle
    ctx.fillStyle = '#FFAAAA';
    ctx.font = '20px Arial';
    ctx.fillText('The mullah caught you sneaking!', width / 2, height / 2 + 50);

    // Score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Final Score: ${score}`, width / 2, height / 2 + 100);

    if (score >= highScore && score > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('NEW HIGH SCORE!', width / 2, height / 2 + 130);
    } else {
      ctx.fillStyle = '#AAAAAA';
      ctx.font = '18px Arial';
      ctx.fillText(`Best: ${highScore}`, width / 2, height / 2 + 130);
    }

    // Retry prompt
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    const pulse = Math.sin(frameCount * 0.05) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE or Click to Retry', width / 2, height / 2 + 175);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get 2D context with performance hints
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    engineRef.current = new GameEngine();
    lastFrameTimeRef.current = performance.now();

    const gameLoop = (currentTime: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      // Calculate delta time
      const deltaTime = currentTime - lastFrameTimeRef.current;

      // Only update if enough time has passed (frame rate limiting for mobile)
      if (deltaTime >= FRAME_TIME * 0.9) {
        lastFrameTimeRef.current = currentTime;
        frameCountRef.current++;

        engine.update();
        draw(ctx, engine, frameCountRef.current);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.handleInput();
      }
    };

    const handleClick = () => {
      engineRef.current?.handleInput();
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      engineRef.current?.handleInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    canvasRef.current?.addEventListener('click', handleClick);
    canvasRef.current?.addEventListener('touchstart', handleTouch, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvasRef.current?.removeEventListener('click', handleClick);
      canvasRef.current?.removeEventListener('touchstart', handleTouch);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="border-4 border-gray-700 rounded-lg shadow-2xl cursor-pointer max-w-full"
      />
      <p className="text-gray-400 mt-4 text-sm">
        Press SPACE or Click when the mullah looks away to toss the turban!
      </p>
      <a
        href="https://github.com/sohei1l"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-gray-300 mt-6 text-xs transition-colors"
      >
        Made by @sohei1l
      </a>
    </div>
  );
}
