import React, { useRef, useEffect, useState } from 'react';

const DrawingCanvas = ({ onDrawUpdate, isReadOnly, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'fill'

  const palette = [
    '#000000', '#FFFFFF', '#FF3B3B', '#FF8C00',
    '#FFD700', '#4CAF50', '#00BCD4', '#2196F3',
    '#9C27B0', '#FF69B4', '#8B4513', '#607D8B'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 700;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = brushSize;
    context.strokeStyle = color;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setCtx(context);

    if (initialData) {
      const img = new Image();
      img.onload = () => context.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, [initialData]);

  useEffect(() => {
    if (ctx) {
      ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    }
  }, [color, brushSize, tool, ctx]);

  const floodFill = (startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const targetIdx = (startY * canvas.width + startX) * 4;
    const targetR = data[targetIdx], targetG = data[targetIdx + 1], targetB = data[targetIdx + 2];

    const hex = fillColor.replace('#', '');
    const fillR = parseInt(hex.substring(0, 2), 16);
    const fillG = parseInt(hex.substring(2, 4), 16);
    const fillB = parseInt(hex.substring(4, 6), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const matchColor = (idx) =>
      Math.abs(data[idx] - targetR) < 30 &&
      Math.abs(data[idx + 1] - targetG) < 30 &&
      Math.abs(data[idx + 2] - targetB) < 30;

    const stack = [[startX, startY]];
    const visited = new Set();

    while (stack.length) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;
      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      const idx = (y * canvas.width + x) * 4;
      if (!matchColor(idx)) continue;
      visited.add(key);
      data[idx] = fillR; data[idx + 1] = fillG; data[idx + 2] = fillB; data[idx + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    context.putImageData(imageData, 0, 0);
    onDrawUpdate && onDrawUpdate(canvas.toDataURL());
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        offsetX: (e.touches[0].clientX - rect.left) * scaleX,
        offsetY: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      offsetX: e.nativeEvent.offsetX * scaleX,
      offsetY: e.nativeEvent.offsetY * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (isReadOnly) return;
    e.preventDefault();
    const { offsetX, offsetY } = getPos(e);
    if (tool === 'fill') {
      floodFill(Math.floor(offsetX), Math.floor(offsetY), color);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || isReadOnly) return;
    e.preventDefault();
    const { offsetX, offsetY } = getPos(e);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    onDrawUpdate && onDrawUpdate(canvasRef.current.toDataURL());
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onDrawUpdate && onDrawUpdate(canvas.toDataURL());
  };

  if (isReadOnly) {
    return (
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '3px solid #2d2d2d', background: '#fff' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
      {/* Canvas */}
      <div style={{
        border: '4px solid #1a1a2e',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '6px 6px 0px #1a1a2e',
        cursor: tool === 'fill' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default',
        background: '#fff',
        width: '100%',
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
        />
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#1a1a2e',
        padding: '10px 16px',
        borderRadius: '50px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        boxShadow: '0 4px 0 #0d0d1a',
      }}>
        {/* Color Palette */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '180px' }}>
          {palette.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              style={{
                width: '22px', height: '22px',
                background: c,
                border: color === c && tool === 'pen' ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'transform 0.1s',
                transform: color === c && tool === 'pen' ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Brush Sizes */}
        {[2, 5, 10, 18].map(size => (
          <button
            key={size}
            onClick={() => { setBrushSize(size); setTool('pen'); }}
            style={{
              width: '32px', height: '32px',
              background: brushSize === size && tool === 'pen' ? '#FFD700' : 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: `${Math.min(size * 1.2, 20)}px`,
              height: `${Math.min(size * 1.2, 20)}px`,
              background: brushSize === size && tool === 'pen' ? '#1a1a2e' : '#fff',
              borderRadius: '50%',
            }} />
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Tools */}
        {[
          { id: 'fill', label: '🪣', title: 'Fill' },
          { id: 'eraser', label: '◻', title: 'Eraser' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.title}
            style={{
              width: '36px', height: '36px',
              background: tool === t.id ? '#FFD700' : 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              color: tool === t.id ? '#1a1a2e' : '#fff',
            }}
          >
            {t.label}
          </button>
        ))}

        <button
          onClick={clearCanvas}
          title="Clear"
          style={{
            width: '36px', height: '36px',
            background: '#FF3B3B',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;