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
 *
 * Behaviour:
 * - Backdrop appears instantly (dark overlay provides contrast for particles)
 * - Pixels stream from last-clicked button toward the modal card
 * - Modal card is invisible until the last pixel lands, then fades in
 * - On mobile: measures the fixed-positioned first child (bottom-sheet content)
 * - prefers-reduced-motion: standard slideUp / slideUpMobile CSS animations play
 */
export default function PixelModalOverlay({ onClose, overlayClass, innerClass, children }: Props) {
  const [ready, setReady] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const pixelContainerRef = useRef<HTMLDivElement | null>(null);

  const rm = prefersReducedMotion();

  useLayoutEffect(() => {
    if (rm) {
      setReady(true);
      return;
    }

    const triggerRect = getLastButtonRect();
    if (!triggerRect) {
      setReady(true);
      return;
    }

    // One RAF to let children render so the modal card has a real layout position
    const rafId = requestAnimationFrame(() => {
      const inner = innerRef.current;
      if (!inner) { setReady(true); return; }

      // On mobile the actual sheet is position:fixed on the first child — measure it
      const measureEl = isMobile()
        ? (inner.firstElementChild as HTMLElement | null) ?? inner
        : inner;

      const modalRect = measureEl.getBoundingClientRect();

      // Guard: if rect is degenerate (e.g. not yet laid out), skip animation
      if (modalRect.width < 20 || modalRect.height < 20) {
        setReady(true);
        return;
      }

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;';
      document.body.appendChild(container);
      pixelContainerRef.current = container;

      animatePixelsFromPoint(
        triggerRect.left + triggerRect.width / 2,
        triggerRect.top + triggerRect.height / 2,
        modalRect,
        container
      ).then(() => {
        if (pixelContainerRef.current && document.body.contains(pixelContainerRef.current)) {
          document.body.removeChild(pixelContainerRef.current);
          pixelContainerRef.current = null;
        }
        setReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (pixelContainerRef.current && document.body.contains(pixelContainerRef.current)) {
        document.body.removeChild(pixelContainerRef.current);
        pixelContainerRef.current = null;
      }
    };
  }, []); // mount-only

  // Backdrop: override the CSS fadeIn so the dark overlay appears instantly,
  // giving particles a visible dark background to fly against.
  const overlayStyle: React.CSSProperties = rm ? {} : { animation: 'none' };

  // Modal card: hidden (opacity 0) while particles assemble, then snaps in.
  // Reduced-motion path keeps the existing CSS slideUp / slideUpMobile.
  const innerStyle: React.CSSProperties = rm
    ? { animation: isMobile() ? undefined : 'slideUp .25s' }
    : {
        opacity: ready ? 1 : 0,
        transition: ready ? 'opacity 0.08s' : 'none',
        animation: 'none',
      };

  return (
    <div
      className={overlayClass}
      onClick={ready ? onClose : undefined}
      style={overlayStyle}
    >
      <div
        ref={innerRef}
        className={innerClass}
        onClick={e => e.stopPropagation()}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
