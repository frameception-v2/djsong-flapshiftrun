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

// Helicopter dimensions
const HELICOPTER_WIDTH = 60;
const HELICOPTER_HEIGHT = 30;

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Background scroll position
  const [bgScrollX, setBgScrollX] = useState(0);
  
  // Helicopter physics state
  const [heliPosition, setHeliPosition] = useState({ x: 0, y: 0 });
  const [heliVelocity, setHeliVelocity] = useState(0);
  const [isThrusting, setIsThrusting] = useState(false);
  
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
    }
  }, [status, width, height]);

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      console.error("Error adding frame:", error);
    }
  }, []);

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

  // Draw the helicopter
  const drawHelicopter = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number) => {
    // Calculate rotation based on velocity
    const rotation = velocity * ROTATION_FACTOR;
    
    // Save the current context state
    ctx.save();
    
    // Translate to the helicopter's position
    ctx.translate(x, y);
    
    // Rotate based on velocity
    ctx.rotate(rotation * Math.PI / 180);
    
    // Draw helicopter body
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.fillRect(-HELICOPTER_WIDTH / 2, -HELICOPTER_HEIGHT / 2, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    
    // Draw helicopter rotor
    ctx.fillStyle = '#333';
    ctx.fillRect(-HELICOPTER_WIDTH / 2 - 5, -HELICOPTER_HEIGHT / 2 - 5, HELICOPTER_WIDTH + 10, 5);
    
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
    }
    
    // Draw hitbox for debugging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.strokeRect(-HELICOPTER_WIDTH / 2, -HELICOPTER_HEIGHT / 2, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    }
    
    // Restore the context state
    ctx.restore();
  }, [isThrusting]);

  // Basic render function to test canvas
  const renderCanvas = useCallback(() => {
    if (!context || !canvas) return;
    
    // Clear the canvas
    context.clearRect(0, 0, width, height);
    
    // Draw the scrolling background
    drawBackground(context, width, height, bgScrollX);
    
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
      drawHelicopter(context, width / 4, height / 2, 0);
    }
    
    // If game is in PLAYING state, draw score and helicopter
    if (status === 'PLAYING') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'right';
      context.textBaseline = 'top';
      context.fillText(`Score: ${score}`, width - 20, 20);
      
      // Draw the helicopter at its current position
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity);
    }
    
    // If game is in GAME_OVER state, draw game over message
    if (status === 'GAME_OVER') {
      // Draw the helicopter in its crashed position
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity);
      
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
    heliPosition, 
    heliVelocity,
    drawHelicopter
  ]);

  // Update helicopter physics
  const updateHelicopter = useCallback((deltaTime: number) => {
    if (status !== 'PLAYING') return;
    
    // Apply gravity or thrust
    const acceleration = isThrusting ? THRUST : GRAVITY;
    
    // Update velocity with acceleration
    let newVelocity = heliVelocity + acceleration * deltaTime;
    
    // Clamp velocity to maximum
    newVelocity = Math.max(Math.min(newVelocity, MAX_VELOCITY), -MAX_VELOCITY);
    
    // Update position with velocity
    const newY = heliPosition.y + newVelocity * deltaTime;
    
    // Check for collisions with ground or ceiling
    if (newY > height - GROUND_HEIGHT - HELICOPTER_HEIGHT / 2) {
      // Hit the ground
      endGame();
      return;
    }
    
    if (newY < HELICOPTER_HEIGHT / 2) {
      // Hit the ceiling
      setHeliPosition({
        ...heliPosition,
        y: HELICOPTER_HEIGHT / 2
      });
      setHeliVelocity(0);
      return;
    }
    
    // Update state
    setHeliPosition({
      ...heliPosition,
      y: newY
    });
    setHeliVelocity(newVelocity);
  }, [status, heliPosition, heliVelocity, isThrusting, height, endGame]);

  // Use game loop for animation with proper delta time
  useGameLoop((deltaTime) => {
    // Update background scroll position based on game state
    if (status === 'PLAYING') {
      // Update background scroll position
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * deltaTime);
      
      // Update helicopter physics
      updateHelicopter(deltaTime);
    } else if (status === 'START') {
      // Slow scroll in start screen for visual interest
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * 0.2 * deltaTime);
    }
    
    // Render the canvas regardless of game state
    renderCanvas();
  }, !!context && !!canvas);

  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await sdk.context;
        if (!ctx) {
          console.warn("No context available");
          return;
        }

        setContext(ctx);
        setAdded(ctx.client?.added || false);

        // If frame isn't already added, prompt user to add it
        if (!ctx.client?.added) {
          addFrame();
        }

        sdk.on("frameAdded", () => {
          setAdded(true);
        });

        sdk.on("frameRemoved", () => {
          setAdded(false);
        });

        // Signal that the frame is ready
        sdk.actions.ready({});
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
  }, [status, startGame, restartGame, endGame, context, canvas, width, height]);

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
