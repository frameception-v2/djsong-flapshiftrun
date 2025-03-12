"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, {
  type Context,
} from "@farcaster/frame-sdk";
import { PROJECT_TITLE } from "~/lib/constants";
import { useGameState } from "~/hooks/useGameState";
import { useCanvas } from "~/hooks/useCanvas";
import { useGameLoop } from "~/hooks/useGameLoop";

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
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

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      console.error("Error adding frame:", error);
    }
  }, []);

  // Basic render function to test canvas
  const renderCanvas = useCallback(() => {
    if (!context || !canvas) return;
    
    // Clear the canvas
    context.clearRect(0, 0, width, height);
    
    // Draw a simple background
    context.fillStyle = '#87CEEB';
    context.fillRect(0, 0, width, height);
    
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
    }
    
    // If game is in PLAYING state, draw score
    if (status === 'PLAYING') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'right';
      context.textBaseline = 'top';
      context.fillText(`Score: ${score}`, width - 20, 20);
      
      // Draw a placeholder helicopter
      context.fillStyle = 'yellow';
      context.fillRect(width / 4, height / 2, 50, 30);
    }
    
    // If game is in GAME_OVER state, draw game over message
    if (status === 'GAME_OVER') {
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
  }, [context, canvas, width, height, status, score, bestScore, lastScore, hasPlayedBefore, PROJECT_TITLE]);

  // Use game loop for animation
  useGameLoop((deltaTime) => {
    renderCanvas();
  }, !!context);

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
      } else if (status === 'PLAYING') {
        // For testing purposes, increment score on tap during gameplay
        incrementScore();
        
        // For testing purposes, end game after score reaches 10
        if (score >= 9) {
          endGame();
        }
      }
    };

    container.addEventListener('click', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('click', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [status, startGame, restartGame, endGame, incrementScore, score, context, canvas, width, height]);

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
