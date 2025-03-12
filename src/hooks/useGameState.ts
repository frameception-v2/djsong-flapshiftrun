import { useLocalStorage } from './useLocalStorage';

// Game state types
export type GameStatus = 'START' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  status: GameStatus;
  score: number;
  bestScore: number;
  lastScore: number;
}

// Default initial state
const initialGameState: GameState = {
  status: 'START',
  score: 0,
  bestScore: 0,
  lastScore: 0,
};

/**
 * Custom hook for managing game state with localStorage persistence
 */
export function useGameState() {
  // Use localStorage to persist the best score
  const [bestScore, setBestScore] = useLocalStorage<number>('flappy-helicopter-best-score', 0);
  
  // Use localStorage for the last played score
  const [lastScore, setLastScore] = useLocalStorage<number>('flappy-helicopter-last-score', 0);
  
  // Use localStorage to track if the user has played before
  const [hasPlayedBefore, setHasPlayedBefore] = useLocalStorage<boolean>('flappy-helicopter-played', false);

  // Create a function to update the score and check for new best score
  const updateScore = (newScore: number) => {
    setLastScore(newScore);
    
    if (newScore > bestScore) {
      setBestScore(newScore);
      return true; // Return true if it's a new best score
    }
    
    return false;
  };

  // Mark that the user has played the game
  const markAsPlayed = () => {
    if (!hasPlayedBefore) {
      setHasPlayedBefore(true);
    }
  };

  return {
    bestScore,
    lastScore,
    hasPlayedBefore,
    updateScore,
    markAsPlayed,
  };
}
