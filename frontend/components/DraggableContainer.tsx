'use client';

import { useState, useRef, useEffect } from 'react';

export interface DraggableContainerProps {
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number; right?: boolean; bottom?: boolean };
  centerHorizontally?: boolean;
  className?: string;
  zIndex?: number;
}

export function DraggableContainer({
  children,
  defaultPosition = { x: 16, y: 16 },
  centerHorizontally = false,
  className = '',
  zIndex = 1000,
}: DraggableContainerProps) {
  const [position, setPosition] = useState({
    x: defaultPosition.x,
    y: defaultPosition.y,
  });
  const [hasDragged, setHasDragged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    const parent = container?.parentElement;
    if (!container || !parent) return;

    const parentRect = parent.getBoundingClientRect();
    const rect = container.getBoundingClientRect();

    let currentX = rect.left - parentRect.left;
    let currentY = rect.top - parentRect.top;

    setHasDragged(true);
    setPosition({ x: currentX, y: currentY });

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !containerRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    let newX = dragStartRef.current.posX + deltaX;
    let newY = dragStartRef.current.posY + deltaY;

    const parent = containerRef.current.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const rect = containerRef.current.getBoundingClientRect();

      newX = Math.max(8, Math.min(parentRect.width - rect.width - 8, newX));
      newY = Math.max(8, Math.min(parentRect.height - rect.height - 8, newY));
    }

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const target = e.target as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch (err) {}
    dragStartRef.current = null;
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex,
    touchAction: 'none',
  };

  if (hasDragged) {
    style.left = `${position.x}px`;
    style.top = `${position.y}px`;
  } else {
    if (centerHorizontally) {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
      if (defaultPosition.bottom) {
        style.bottom = `${defaultPosition.y}px`;
      } else {
        style.top = `${defaultPosition.y}px`;
      }
    } else {
      if (defaultPosition.right) {
        style.right = `${defaultPosition.x}px`;
      } else {
        style.left = `${defaultPosition.x}px`;
      }

      if (defaultPosition.bottom) {
        style.bottom = `${defaultPosition.y}px`;
      } else {
        style.top = `${defaultPosition.y}px`;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={style}
      className={`select-none cursor-move ${className}`}
    >
      {children}
    </div>
  );
}
