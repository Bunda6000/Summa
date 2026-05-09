import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  animatePixelsFromPoint,
  prefersReducedMotion,
  isMobile,
  getLastButtonRect,
} from '../lib/pixelAnimation';

interface Props {
  onClose: () => void;
  overlayClass: string;
  innerClass: string;
  children: ReactNode;
}

/**
 * Drop-in overlay wrapper that plays a pixel-stream intro when mounted.
 * Pixels fly from the last-clicked button toward the modal card, then the
 * card fades in. Falls back to the standard slideUp / slideUpMobile animation
 * on mobile or when prefers-reduced-motion is set.
 */
export default function PixelModalOverlay({ onClose, overlayClass, innerClass, children }: Props) {
  const [ready, setReady] = useState(false);
  const [backdropVisible, setBackdropVisible] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const pixelContainerRef = useRef<HTMLDivElement | null>(null);

  const rm = prefersReducedMotion();
  const mob = isMobile();
  const skip = rm || mob;

  useLayoutEffect(() => {
    if (skip) {
      setReady(true);
      setBackdropVisible(true);
      return;
    }

    const triggerRect = getLastButtonRect();
    if (!triggerRect) {
      setReady(true);
      setBackdropVisible(true);
      return;
    }

    // One RAF to let children render so we can measure the modal card
    const rafId = requestAnimationFrame(() => {
      const inner = innerRef.current;
      if (!inner) { setReady(true); setBackdropVisible(true); return; }

      const modalRect = inner.getBoundingClientRect();

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;';
      document.body.appendChild(container);
      pixelContainerRef.current = container;

      // Backdrop fades in after 150 ms so the backdrop appears mid-flight
      const bdTimer = setTimeout(() => setBackdropVisible(true), 150);

      const cx = triggerRect.left + triggerRect.width / 2;
      const cy = triggerRect.top + triggerRect.height / 2;

      animatePixelsFromPoint(cx, cy, modalRect, container).then(() => {
        if (pixelContainerRef.current && document.body.contains(pixelContainerRef.current)) {
          document.body.removeChild(pixelContainerRef.current);
          pixelContainerRef.current = null;
        }
        setReady(true);
      });

      return () => clearTimeout(bdTimer);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (pixelContainerRef.current && document.body.contains(pixelContainerRef.current)) {
        document.body.removeChild(pixelContainerRef.current);
        pixelContainerRef.current = null;
      }
    };
  }, []); // mount-only

  // Overlay backdrop opacity
  const overlayStyle: React.CSSProperties = {
    opacity: backdropVisible ? 1 : 0,
    transition: 'opacity 0.2s',
    pointerEvents: backdropVisible ? undefined : 'none',
  };

  // Inner modal card opacity + animation
  const innerStyle: React.CSSProperties = skip
    ? { animation: mob ? undefined : 'slideUp .25s' }
    : {
        opacity: ready ? 1 : 0,
        transition: ready ? 'opacity 0.1s' : 'none',
        animation: 'none',
      };

  return (
    <div className={overlayClass} onClick={ready || backdropVisible ? onClose : undefined} style={overlayStyle}>
      <div ref={innerRef} className={innerClass} onClick={e => e.stopPropagation()} style={innerStyle}>
        {children}
      </div>
    </div>
  );
}
