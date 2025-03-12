"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import { PROJECT_TITLE } from "~/lib/constants";
import { useGameState, GameStatus } from "~/hooks/useGameState";

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>('START');
  const [currentScore, setCurrentScore] = useState(0);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Use our custom game state hook
  const { bestScore, lastScore, hasPlayedBefore, updateScore, markAsPlayed } = useGameState();

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      console.error("Error adding frame:", error);
    }
  }, []);

  // Handle game start
  const handleStartGame = useCallback(() => {
    setGameStatus('PLAYING');
    setCurrentScore(0);
    markAsPlayed();
  }, [markAsPlayed]);

  // Handle game over
  const handleGameOver = useCallback(() => {
    setGameStatus('GAME_OVER');
    const isNewBest = updateScore(currentScore);
    console.log(`Game over! Score: ${currentScore}, Best: ${bestScore}, New record: ${isNewBest}`);
  }, [currentScore, bestScore, updateScore]);

  // Handle restart game
  const handleRestartGame = useCallback(() => {
    setGameStatus('START');
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
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

    const handleInteraction = () => {
      if (gameStatus === 'START') {
        handleStartGame();
      }
    };

    container.addEventListener('click', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('click', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [gameStatus, handleStartGame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
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
      >
        {gameStatus === 'START' && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "white",
              fontSize: "24px",
              fontWeight: "bold",
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
            }}
          >
            {PROJECT_TITLE}
            <div style={{ fontSize: "18px", marginTop: "10px" }}>
              Tap to start
            </div>
            {hasPlayedBefore && (
              <div style={{ fontSize: "16px", marginTop: "20px" }}>
                Best Score: {bestScore}
                {lastScore > 0 && <div>Last Score: {lastScore}</div>}
              </div>
            )}
          </div>
        )}

        {gameStatus === 'PLAYING' && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              color: "white",
              fontSize: "24px",
              fontWeight: "bold",
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
            }}
          >
            Score: {currentScore}
          </div>
        )}

        {gameStatus === 'GAME_OVER' && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "white",
              fontSize: "28px",
              fontWeight: "bold",
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              padding: "20px",
              borderRadius: "10px",
            }}
          >
            Game Over!
            <div style={{ fontSize: "20px", marginTop: "10px" }}>
              Score: {currentScore}
            </div>
            <div style={{ fontSize: "16px", marginTop: "5px" }}>
              Best Score: {bestScore}
            </div>
            <button
              onClick={handleRestartGame}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
