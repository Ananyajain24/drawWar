import React, { useRef, useEffect, useState } from 'react';

const DrawingCanvas = ({ onDrawUpdate, isReadOnly, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineWidth = 5;
    context.strokeStyle = '#000000';
    setCtx(context);

    if (initialData) {
      const img = new Image();
      img.onload = () => context.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, [initialData]);

  const startDrawing = (e) => {
    if (isReadOnly) return;
    const { offsetX, offsetY } = e.nativeEvent;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || isReadOnly) return;
    const { offsetX, offsetY } = e.nativeEvent;
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    
    // Throttle these for performance in real use
    onDrawUpdate && onDrawUpdate(canvasRef.current.toDataURL());
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />
    </div>
  );
};

export default DrawingCanvas;
