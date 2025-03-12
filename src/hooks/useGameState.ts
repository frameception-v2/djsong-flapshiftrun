import { useState, useEffect } from 'react';

export type GameStatus = 'START' | 'PLAYING' | 'GAME_OVER';

interface GameState {
  status: GameStatus;
  score: number;
  bestScore: number;
  lastScore: number;
  hasPlayedBefore: boolean;
  startGame: () => void;
  endGame: () => void;
  restartGame: () => void;
  incrementScore: () => void;
}

export function useGameState(): GameState {
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [hasPlayedBefore, setHasPlayedBefore] = useState(false);

  // Load scores from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBestScore = localStorage.getItem('flappyHelicopter_bestScore');
      const storedLastScore = localStorage.getItem('flappyHelicopter_lastScore');
      const storedHasPlayed = localStorage.getItem('flappyHelicopter_hasPlayed');

      if (storedBestScore) {
        setBestScore(parseInt(storedBestScore, 10));
      }
      
      if (storedLastScore) {
        setLastScore(parseInt(storedLastScore, 10));
      }
      
      if (storedHasPlayed) {
        setHasPlayedBefore(storedHasPlayed === 'true');
      }
    }
  }, []);

  // Start the game
  const startGame = () => {
    setStatus('PLAYING');
    setScore(0);
    setHasPlayedBefore(true);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('flappyHelicopter_hasPlayed', 'true');
    }
  };

  // End the game and update scores
  const endGame = () => {
    setStatus('GAME_OVER');
    setLastScore(score);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('flappyHelicopter_lastScore', score.toString());
    }
    
    // Check if this is a new best score
    if (score > bestScore) {
      setBestScore(score);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('flappyHelicopter_bestScore', score.toString());
      }
    }
  };

  // Restart the game (go back to start screen)
  const restartGame = () => {
    setStatus('START');
  };

  // Increment the score
  const incrementScore = () => {
    setScore(prevScore => prevScore + 1);
  };

  return {
    status,
    score,
    bestScore,
    lastScore,
    hasPlayedBefore,
    startGame,
    endGame,
    restartGame,
    incrementScore
  };
}
