import React, { useState, useRef } from 'react';

interface JoystickProps {
  onMove?: (data: any) => void; // Keep for compatibility but won't be used
}

const Joystick: React.FC<JoystickProps> = ({ onMove: _onMove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 60, y: 60 }); // Center position for smaller joystick
  const joystickRef = useRef<HTMLDivElement>(null);
  const currentKeysRef = useRef<Set<string>>(new Set());

  const dispatchKeyEvent = (key: string, type: 'keydown' | 'keyup') => {
    const event = new KeyboardEvent(type, {
      code: key,
      key: key.toLowerCase().replace('arrow', ''),
      bubbles: true
    });
    window.dispatchEvent(event);
  };

  const updateMovement = (x: number, y: number) => {
    const centerX = 60;
    const centerY = 60;
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const threshold = 40; // Adjusted threshold for smaller joystick

    // Clear previous keys
    currentKeysRef.current.forEach(key => {
      dispatchKeyEvent(key, 'keyup');
    });
    currentKeysRef.current.clear();

    // Determine new keys based on position
    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
      if (deltaY < -threshold) { // Up
        currentKeysRef.current.add('ArrowUp');
        dispatchKeyEvent('ArrowUp', 'keydown');
      }
      if (deltaY > threshold) { // Down
        currentKeysRef.current.add('ArrowDown');
        dispatchKeyEvent('ArrowDown', 'keydown');
      }
      if (deltaX < -threshold) { // Left
        currentKeysRef.current.add('ArrowLeft');
        dispatchKeyEvent('ArrowLeft', 'keydown');
      }
      if (deltaX > threshold) { // Right
        currentKeysRef.current.add('ArrowRight');
        dispatchKeyEvent('ArrowRight', 'keydown');
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !joystickRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(120, e.clientX - rect.left));
    const y = Math.max(0, Math.min(120, e.clientY - rect.top));
    
    setKnobPosition({ x, y });
    updateMovement(x, y);
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !joystickRef.current) return;
    
    e.preventDefault(); // Only prevent default for joystick touches
    const rect = joystickRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(120, touch.clientX - rect.left));
    const y = Math.max(0, Math.min(120, touch.clientY - rect.top));
    
    setKnobPosition({ x, y });
    updateMovement(x, y);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setKnobPosition({ x: 60, y: 60 }); // Return to center (adjusted for smaller size)
    
    // Clear all movement keys
    currentKeysRef.current.forEach(key => {
      dispatchKeyEvent(key, 'keyup');
    });
    currentKeysRef.current.clear();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setKnobPosition({ x: 60, y: 60 }); // Return to center
    
    // Clear all movement keys
    currentKeysRef.current.forEach(key => {
      dispatchKeyEvent(key, 'keyup');
    });
    currentKeysRef.current.clear();
  };

  // Handle mouse and touch events on document for better UX
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!joystickRef.current) return;
        const rect = joystickRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(120, e.clientX - rect.left));
        const y = Math.max(0, Math.min(120, e.clientY - rect.top));
        setKnobPosition({ x, y });
        updateMovement(x, y);
      };

      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (!joystickRef.current) return;
        
        // Only prevent default if the touch is within the joystick area
        const rect = joystickRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Check if touch is within joystick bounds
        if (touchX >= rect.left && touchX <= rect.right && 
            touchY >= rect.top && touchY <= rect.bottom) {
          e.preventDefault();
        }
        
        const x = Math.max(0, Math.min(120, touchX - rect.left));
        const y = Math.max(0, Math.min(120, touchY - rect.top));
        setKnobPosition({ x, y });
        updateMovement(x, y);
      };

      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };

      const handleGlobalTouchEnd = () => {
        handleTouchEnd();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
      };
    }
  }, [isDragging]);

  return (
    <div
      ref={joystickRef}
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '20px',
        width: '120px',
        height: '120px',
        borderRadius: '0px', // Remove rounded corners for pixelated look
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        border: '3px solid #ffffff',
        zIndex: 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)',
        imageRendering: 'pixelated'
      }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Joystick knob */}
      <div
        style={{
          position: 'absolute',
          left: `${knobPosition.x - 20}px`,
          top: `${knobPosition.y - 20}px`,
          width: '40px',
          height: '40px',
          borderRadius: '0px', // Remove rounded corners for pixelated look
          backgroundColor: 'white',
          border: '3px solid #2d3436',
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: '2px 2px 0px #2d3436, 4px 4px 0px rgba(0,0,0,0.3)',
          transition: isDragging ? 'none' : 'all 0.2s ease',
          touchAction: 'none',
          imageRendering: 'pixelated'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
};

export default Joystick;