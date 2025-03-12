import { useRef, useEffect, useState } from 'react';

type CanvasContextType = {
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  width: number;
  height: number;
};

export function useCanvas(containerRef: React.RefObject<HTMLDivElement>): CanvasContextType {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Create and initialize the canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Create canvas if it doesn't exist
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      containerRef.current.appendChild(canvas);
      canvasRef.current = canvas;
      
      // Get the 2D context
      const ctx = canvas.getContext('2d');
      if (ctx) {
        setContext(ctx);
      }
    }

    // Function to resize canvas
    const resizeCanvas = () => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      // Set canvas dimensions to match container
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      // Update dimensions state
      setDimensions({ width, height });
    };

    // Initial resize
    resizeCanvas();
    
    // Add resize listener
    window.addEventListener('resize', resizeCanvas);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      
      // Remove canvas from DOM if component unmounts
      if (canvasRef.current && containerRef.current) {
        containerRef.current.removeChild(canvasRef.current);
      }
    };
  }, [containerRef]);

  return {
    canvas: canvasRef.current,
    context,
    width: dimensions.width,
    height: dimensions.height
  };
}
