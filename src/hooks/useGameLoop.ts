import { useRef, useEffect, useCallback } from 'react';

type GameLoopCallback = (deltaTime: number) => void;

export function useGameLoop(callback: GameLoopCallback, isActive: boolean = true) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  
  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(animate);
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [isActive, animate]);

  return {
    stop: useCallback(() => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    }, []),
    start: useCallback(() => {
      if (!requestRef.current) {
        previousTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(animate);
      }
    }, [animate]),
  };
}
