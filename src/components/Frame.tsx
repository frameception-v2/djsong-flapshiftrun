"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, {
  type Context,
} from "@farcaster/frame-sdk";
import { PROJECT_TITLE } from "~/lib/constants";
import { useGameState } from "~/hooks/useGameState";
import { useCanvas } from "~/hooks/useCanvas";
import { useGameLoop } from "~/hooks/useGameLoop";

// Background scroll configuration
const BACKGROUND_SCROLL_SPEED = 50; // pixels per second
const GROUND_HEIGHT = 50; // pixels

// Helicopter physics parameters
const GRAVITY = 600; // pixels per second squared
const THRUST = -400; // negative because y-axis is inverted in canvas
const MAX_VELOCITY = 400; // maximum vertical velocity
const ROTATION_FACTOR = 0.15; // how much the helicopter rotates based on velocity
const HORIZONTAL_SPEED = 60; // constant horizontal speed
const ACCELERATION_FACTOR = 0.85; // smoothing factor for acceleration (0-1)
const DECELERATION_FACTOR = 0.95; // smoothing factor for deceleration (0-1)
const TERMINAL_VELOCITY = 800; // absolute maximum velocity

// Helicopter dimensions
const HELICOPTER_WIDTH = 60;
const HELICOPTER_HEIGHT = 30;

// Hitbox configuration (slightly smaller than visual size for better gameplay)
const HITBOX_PADDING = 5; // pixels to reduce hitbox size by

// Collision types
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Obstacle configuration
type Obstacle = {
  x: number;
  topHeight: number;
  bottomY: number;
  bottomHeight: number;
  width: number;
  passed: boolean;
};

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext | undefined>();
  const [added, setAdded] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Background scroll position
  const [bgScrollX, setBgScrollX] = useState(0);
  
  // Helicopter physics state
  const [heliPosition, setHeliPosition] = useState({ x: 0, y: 0 });
  const [heliVelocity, setHeliVelocity] = useState(0);
  const [heliAcceleration, setHeliAcceleration] = useState(0);
  const [isThrusting, setIsThrusting] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  
  // Collision state
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [collisionDebug, setCollisionDebug] = useState(false);
  
  // Transaction hash for potential future use
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Use our custom game state hook
  const { 
    status, 
    score, 
    bestScore, 
    lastScore, 
    hasPlayedBefore, 
    startGame, 
    endGame, 
    restartGame, 
    incrementScore 
  } = useGameState();
  
  // Use our canvas hook to get the canvas and context
  const { canvas, context, width, height } = useCanvas(gameContainerRef);

  // Reset helicopter position when game starts
  useEffect(() => {
    if (status === 'PLAYING' && width && height) {
      setHeliPosition({
        x: width / 4,
        y: height / 2
      });
      setHeliVelocity(0);
      setHeliAcceleration(0);
      setRotationAngle(0);
      setObstacles([]);
    }
  }, [status, width, height]);

  // Toggle collision debug mode with 'd' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' && process.env.NODE_ENV === 'development') {
        setCollisionDebug(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      console.error("Error adding frame:", error);
    }
  }, []);

  // Get helicopter hitbox
  const getHelicopterHitbox = useCallback((): Rect => {
    return {
      x: heliPosition.x - (HELICOPTER_WIDTH / 2) + HITBOX_PADDING,
      y: heliPosition.y - (HELICOPTER_HEIGHT / 2) + HITBOX_PADDING,
      width: HELICOPTER_WIDTH - (HITBOX_PADDING * 2),
      height: HELICOPTER_HEIGHT - (HITBOX_PADDING * 2)
    };
  }, [heliPosition]);

  // Check if two rectangles intersect (collision detection)
  const checkCollision = useCallback((rect1: Rect, rect2: Rect): boolean => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }, []);

  // Check if helicopter collides with any obstacle
  const checkObstacleCollisions = useCallback(() => {
    if (status !== 'PLAYING') return false;
    
    const heliHitbox = getHelicopterHitbox();
    
    // Check collision with each obstacle
    for (const obstacle of obstacles) {
      // Top pipe hitbox
      const topPipeHitbox: Rect = {
        x: obstacle.x,
        y: 0,
        width: obstacle.width,
        height: obstacle.topHeight
      };
      
      // Bottom pipe hitbox
      const bottomPipeHitbox: Rect = {
        x: obstacle.x,
        y: obstacle.bottomY,
        width: obstacle.width,
        height: obstacle.bottomHeight
      };
      
      // Check collision with either pipe
      if (
        checkCollision(heliHitbox, topPipeHitbox) ||
        checkCollision(heliHitbox, bottomPipeHitbox)
      ) {
        return true;
      }
    }
    
    return false;
  }, [status, obstacles, getHelicopterHitbox, checkCollision]);

  // Draw the scrolling background
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, scrollX: number) => {
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h - GROUND_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB'); // Sky blue at top
    skyGradient.addColorStop(1, '#E0F7FF'); // Lighter blue at horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h - GROUND_HEIGHT);
    
    // Clouds (simple version)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    // Draw a few clouds at different positions
    const cloudPositions = [
      { x: (100 - scrollX * 0.2) % w, y: 50, width: 80, height: 40 },
      { x: (300 - scrollX * 0.2) % w, y: 80, width: 120, height: 50 },
      { x: (600 - scrollX * 0.2) % w, y: 40, width: 100, height: 45 },
      { x: (900 - scrollX * 0.2) % w, y: 70, width: 90, height: 35 },
    ];
    
    // Wrap clouds around the screen
    cloudPositions.forEach(cloud => {
      if (cloud.x < -cloud.width) {
        cloud.x += w + cloud.width;
      }
      
      // Draw a simple cloud shape
      ctx.beginPath();
      ctx.arc(cloud.x + cloud.width * 0.3, cloud.y + cloud.height * 0.5, cloud.height * 0.5, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.7, cloud.y + cloud.height * 0.5, cloud.height * 0.6, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.5, cloud.y + cloud.height * 0.3, cloud.height * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Ground
    const groundGradient = ctx.createLinearGradient(0, h - GROUND_HEIGHT, 0, h);
    groundGradient.addColorStop(0, '#8B4513'); // Brown at top
    groundGradient.addColorStop(1, '#654321'); // Darker brown at bottom
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h - GROUND_HEIGHT, w, GROUND_HEIGHT);
    
    // Ground details (simple stripes)
    ctx.fillStyle = '#5D4037';
    
    // Draw ground stripes that scroll with the background
    const stripeWidth = 30;
    const stripeSpacing = 50;
    const numStripes = Math.ceil(w / stripeSpacing) + 1;
    
    for (let i = 0; i < numStripes; i++) {
      const stripeX = (i * stripeSpacing - scrollX) % w;
      if (stripeX < -stripeWidth) continue;
      ctx.fillRect(stripeX, h - GROUND_HEIGHT + 10, stripeWidth, 5);
    }
  }, []);

  // Draw obstacles (pipes)
  const drawObstacles = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!obstacles.length) return;
    
    // Pipe style
    const pipeColor = '#2E8B57'; // Sea green
    const pipeBorderColor = '#1C6E44';
    const pipeCapHeight = 15;
    
    obstacles.forEach(obstacle => {
      // Draw top pipe
      ctx.fillStyle = pipeColor;
      ctx.fillRect(obstacle.x, 0, obstacle.width, obstacle.topHeight);
      
      // Draw top pipe cap
      ctx.fillStyle = pipeBorderColor;
      ctx.fillRect(obstacle.x - 5, obstacle.topHeight - pipeCapHeight, obstacle.width + 10, pipeCapHeight);
      
      // Draw bottom pipe
      ctx.fillStyle = pipeColor;
      ctx.fillRect(obstacle.x, obstacle.bottomY, obstacle.width, obstacle.bottomHeight);
      
      // Draw bottom pipe cap
      ctx.fillStyle = pipeBorderColor;
      ctx.fillRect(obstacle.x - 5, obstacle.bottomY, obstacle.width + 10, pipeCapHeight);
      
      // Draw hitboxes in debug mode
      if (collisionDebug || process.env.NODE_ENV === 'development') {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        
        // Top pipe hitbox
        ctx.strokeRect(obstacle.x, 0, obstacle.width, obstacle.topHeight);
        
        // Bottom pipe hitbox
        ctx.strokeRect(obstacle.x, obstacle.bottomY, obstacle.width, obstacle.bottomHeight);
      }
    });
  }, [obstacles, collisionDebug]);

  // Draw the helicopter
  const drawHelicopter = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number, rotation: number) => {
    // Save the current context state
    ctx.save();
    
    // Translate to the helicopter's position
    ctx.translate(x, y);
    
    // Rotate based on velocity
    ctx.rotate(rotation * Math.PI / 180);
    
    // Draw helicopter body
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.fillRect(-HELICOPTER_WIDTH / 2, -HELICOPTER_HEIGHT / 2, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    
    // Draw helicopter rotor - animate based on thrust
    ctx.fillStyle = '#333';
    const rotorWidth = HELICOPTER_WIDTH + 10;
    const rotorHeight = 5;
    
    // Rotor animation based on game time
    const rotorOffset = isThrusting ? Math.sin(Date.now() * 0.05) * 5 : 0;
    
    ctx.fillRect(-rotorWidth / 2 + rotorOffset, -HELICOPTER_HEIGHT / 2 - 5, rotorWidth, rotorHeight);
    
    // Draw helicopter tail
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(HELICOPTER_WIDTH / 2 - 5, -HELICOPTER_HEIGHT / 4, HELICOPTER_WIDTH / 2, HELICOPTER_HEIGHT / 2);
    
    // Draw helicopter window
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-HELICOPTER_WIDTH / 4, -HELICOPTER_HEIGHT / 4, HELICOPTER_WIDTH / 3, HELICOPTER_HEIGHT / 2);
    
    // Draw thrust effect when thrusting
    if (isThrusting) {
      ctx.fillStyle = '#FF4500';
      ctx.beginPath();
      ctx.moveTo(-HELICOPTER_WIDTH / 2, 0);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 15, -10);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 15, 10);
      ctx.closePath();
      ctx.fill();
      
      // Add some flame particles
      ctx.fillStyle = '#FFA500';
      ctx.beginPath();
      ctx.moveTo(-HELICOPTER_WIDTH / 2, 0);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 10, -5);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 10, 5);
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw hitbox for debugging
    if (collisionDebug || process.env.NODE_ENV === 'development') {
      const hitbox = getHelicopterHitbox();
      
      // Convert hitbox to local coordinates
      const localHitboxX = hitbox.x - x;
      const localHitboxY = hitbox.y - y;
      
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(localHitboxX, localHitboxY, hitbox.width, hitbox.height);
    }
    
    // Restore the context state
    ctx.restore();
  }, [isThrusting, getHelicopterHitbox, collisionDebug]);

  // Update obstacles - move them and check if they're off screen
  const updateObstacles = useCallback((deltaTime: number) => {
    if (status !== 'PLAYING') return;
    
    // Move obstacles based on scroll speed
    const updatedObstacles = obstacles.map(obstacle => {
      // Move obstacle left
      const newX = obstacle.x - BACKGROUND_SCROLL_SPEED * deltaTime;
      
      // Check if helicopter has passed this obstacle
      let passed = obstacle.passed;
      if (!passed && newX + obstacle.width < heliPosition.x - HELICOPTER_WIDTH / 2) {
        passed = true;
        // Increment score when passing an obstacle
        incrementScore(5);
      }
      
      return {
        ...obstacle,
        x: newX,
        passed
      };
    });
    
    // Remove obstacles that are off screen
    const filteredObstacles = updatedObstacles.filter(
      obstacle => obstacle.x + obstacle.width > 0
    );
    
    // Add new obstacles if needed
    if (filteredObstacles.length < 3) {
      // Calculate position for new obstacle
      const lastObstacleX = filteredObstacles.length > 0
        ? Math.max(...filteredObstacles.map(o => o.x))
        : width;
      
      // Add a new obstacle
      const gapHeight = 150; // Height of the gap between pipes
      const minTopHeight = 50; // Minimum height of top pipe
      const maxTopHeight = height - GROUND_HEIGHT - gapHeight - 50; // Maximum height of top pipe
      
      const topHeight = Math.floor(Math.random() * (maxTopHeight - minTopHeight)) + minTopHeight;
      const bottomY = topHeight + gapHeight;
      
      filteredObstacles.push({
        x: lastObstacleX + 300, // Space obstacles 300px apart
        topHeight,
        bottomY,
        bottomHeight: height - bottomY,
        width: 60,
        passed: false
      });
    }
    
    setObstacles(filteredObstacles);
  }, [status, obstacles, width, height, heliPosition, incrementScore]);

  // Basic render function to test canvas
  const renderCanvas = useCallback(() => {
    if (!context || !canvas) return;
    
    // Clear the canvas
    context.clearRect(0, 0, width, height);
    
    // Draw the scrolling background
    drawBackground(context, width, height, bgScrollX);
    
    // Draw obstacles
    drawObstacles(context);
    
    // If game is in START state, draw a message
    if (status === 'START') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(PROJECT_TITLE, width / 2, height / 2 - 20);
      context.font = '18px Arial';
      context.fillText('Tap to start', width / 2, height / 2 + 20);
      
      if (hasPlayedBefore) {
        context.font = '16px Arial';
        context.fillText(`Best Score: ${bestScore}`, width / 2, height / 2 + 60);
        if (lastScore > 0) {
          context.fillText(`Last Score: ${lastScore}`, width / 2, height / 2 + 90);
        }
      }
      
      // Draw a static helicopter in the start screen
      drawHelicopter(context, width / 4, height / 2, 0, 0);
    }
    
    // If game is in PLAYING state, draw score and helicopter
    if (status === 'PLAYING') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'right';
      context.textBaseline = 'top';
      context.fillText(`Score: ${score}`, width - 20, 20);
      
      // Draw the helicopter at its current position with rotation
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity, rotationAngle);
    }
    
    // If game is in GAME_OVER state, draw game over message
    if (status === 'GAME_OVER') {
      // Draw the helicopter in its crashed position
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity, rotationAngle);
      
      // Semi-transparent overlay
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(width / 2 - 150, height / 2 - 100, 300, 200);
      
      context.fillStyle = 'white';
      context.font = '28px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Game Over!', width / 2, height / 2 - 50);
      
      context.font = '20px Arial';
      context.fillText(`Score: ${score}`, width / 2, height / 2);
      
      context.font = '16px Arial';
      context.fillText(`Best Score: ${bestScore}`, width / 2, height / 2 + 30);
      
      // Draw a button-like shape
      context.fillStyle = '#4CAF50';
      context.fillRect(width / 2 - 75, height / 2 + 60, 150, 40);
      
      context.fillStyle = 'white';
      context.font = '16px Arial';
      context.fillText('Play Again', width / 2, height / 2 + 80);
    }
  }, [
    context, 
    canvas, 
    width, 
    height, 
    status, 
    score, 
    bestScore, 
    lastScore, 
    hasPlayedBefore, 
    PROJECT_TITLE, 
    bgScrollX, 
    drawBackground, 
    drawObstacles,
    heliPosition, 
    heliVelocity,
    rotationAngle,
    drawHelicopter
  ]);

  // Update helicopter physics with improved velocity-based movement
  const updateHelicopter = useCallback((deltaTime: number) => {
    if (status !== 'PLAYING') return;
    
    // Calculate target acceleration based on thrust or gravity
    const targetAcceleration = isThrusting ? THRUST : GRAVITY;
    
    // Smoothly interpolate current acceleration toward target
    const newAcceleration = heliAcceleration * ACCELERATION_FACTOR + 
                           targetAcceleration * (1 - ACCELERATION_FACTOR);
    
    // Update velocity with smoothed acceleration
    let newVelocity = heliVelocity + newAcceleration * deltaTime;
    
    // Apply air resistance (deceleration) when not accelerating strongly
    if (Math.abs(newAcceleration) < Math.abs(targetAcceleration) * 0.8) {
      newVelocity *= DECELERATION_FACTOR;
    }
    
    // Clamp velocity to maximum
    newVelocity = Math.max(Math.min(newVelocity, TERMINAL_VELOCITY), -TERMINAL_VELOCITY);
    
    // Calculate rotation based on velocity with smoothing
    const targetRotation = newVelocity * ROTATION_FACTOR;
    const newRotation = rotationAngle * 0.9 + targetRotation * 0.1;
    
    // Update position with velocity
    const newY = heliPosition.y + newVelocity * deltaTime;
    
    // Move forward at constant speed (horizontal movement)
    const newX = heliPosition.x + HORIZONTAL_SPEED * deltaTime;
    
    // Check for collisions with ground or ceiling
    if (newY > height - GROUND_HEIGHT - HELICOPTER_HEIGHT / 2) {
      // Hit the ground - game over
      endGame();
      return;
    }
    
    if (newY < HELICOPTER_HEIGHT / 2) {
      // Hit the ceiling - bounce slightly
      setHeliPosition({
        ...heliPosition,
        y: HELICOPTER_HEIGHT / 2
      });
      setHeliVelocity(Math.abs(newVelocity) * 0.3); // Bounce with reduced velocity
      setHeliAcceleration(0);
      return;
    }
    
    // Check for collisions with obstacles
    if (checkObstacleCollisions()) {
      // Hit an obstacle - game over
      endGame();
      return;
    }
    
    // Update state
    setHeliPosition({
      x: newX > width * 0.25 ? width * 0.25 : newX, // Keep helicopter at 1/4 of screen width
      y: newY
    });
    setHeliVelocity(newVelocity);
    setHeliAcceleration(newAcceleration);
    setRotationAngle(newRotation);
    
    // Update obstacles
    updateObstacles(deltaTime);
    
    // Increment score based on distance traveled
    if (Math.floor(bgScrollX / 100) !== Math.floor((bgScrollX + HORIZONTAL_SPEED * deltaTime) / 100)) {
      incrementScore(1);
    }
    
  }, [
    status, 
    heliPosition, 
    heliVelocity, 
    heliAcceleration, 
    rotationAngle, 
    isThrusting, 
    height, 
    width, 
    endGame, 
    incrementScore, 
    bgScrollX, 
    checkObstacleCollisions,
    updateObstacles
  ]);

  // Use game loop for animation with proper delta time
  useGameLoop((deltaTime) => {
    // Update background scroll position based on game state
    if (status === 'PLAYING') {
      // Update background scroll position
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * deltaTime / 1000);
      
      // Update helicopter physics
      updateHelicopter(deltaTime / 1000);
    } else if (status === 'START') {
      // Slow scroll in start screen for visual interest
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * 0.2 * deltaTime / 1000);
    }
    
    // Render the canvas regardless of game state
    renderCanvas();
  }, !!context && !!canvas);

  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx);
        setAdded(ctx?.client?.added || false);

        // If frame isn't already added, prompt user to add it
        if (!ctx?.client?.added) {
          addFrame();
        }

        sdk.on("frameAdded", () => {
          setAdded(true);
        });

        sdk.on("frameRemoved", () => {
          setAdded(false);
        });

        // Signal that the frame is ready
        sdk.actions.ready();
      } catch (error) {
        console.error("Error loading SDK context:", error);
      }
    };

    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  // Add click/touch handler to the game container
  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container) return;

    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      if (status === 'START') {
        startGame();
      } else if (status === 'GAME_OVER') {
        // Check if click is on the Play Again button
        if (context && canvas) {
          const rect = canvas.getBoundingClientRect();
          const x = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
          const y = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
          
          // Convert to canvas coordinates
          const canvasX = x - rect.left;
          const canvasY = y - rect.top;
          
          // Check if click is within button bounds
          if (
            canvasX >= width / 2 - 75 &&
            canvasX <= width / 2 + 75 &&
            canvasY >= height / 2 + 60 &&
            canvasY <= height / 2 + 100
          ) {
            restartGame();
          }
        }
      }
    };

    container.addEventListener('click', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('click', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [status, startGame, restartGame, context, canvas, width, height]);

  // Handle pointer down/up for helicopter thrust
  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container) return;
    
    const handlePointerDown = () => {
      if (status === 'PLAYING') {
        setIsThrusting(true);
      }
    };
    
    const handlePointerUp = () => {
      setIsThrusting(false);
    };
    
    container.addEventListener('mousedown', handlePointerDown);
    container.addEventListener('touchstart', handlePointerDown);
    container.addEventListener('mouseup', handlePointerUp);
    container.addEventListener('touchend', handlePointerUp);
    
    // Also listen for pointer leaving the container
    container.addEventListener('mouseleave', handlePointerUp);
    container.addEventListener('touchcancel', handlePointerUp);
    
    return () => {
      container.removeEventListener('mousedown', handlePointerDown);
      container.removeEventListener('touchstart', handlePointerDown);
      container.removeEventListener('mouseup', handlePointerUp);
      container.removeEventListener('touchend', handlePointerUp);
      container.removeEventListener('mouseleave', handlePointerUp);
      container.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [status]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client?.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client?.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client?.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client?.safeAreaInsets?.right ?? 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div 
        ref={gameContainerRef}
        id="game-container"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "500px",
          maxHeight: "800px",
          backgroundColor: "#87CEEB", // Sky blue background
          position: "relative",
          overflow: "hidden",
          touchAction: "none", // Prevent default touch actions
        }}
      />
    </div>
  );
}
