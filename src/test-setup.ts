import "@testing-library/jest-dom";

// jsdom does not implement Element.prototype.animate (Web Animations API)
// Stub it to prevent non-fatal errors from pixel-animation effects in tests.
if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      finished: Promise.resolve(),
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      onfinish: null,
      oncancel: null,
    }) as unknown as Animation;
}

// jsdom does not implement window.matchMedia — stub it so components that call
// prefersReducedMotion() don't crash during unit tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
