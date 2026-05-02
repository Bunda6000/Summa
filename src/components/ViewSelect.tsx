import { useState, useEffect, useRef } from 'react';

interface ViewOption {
  id: string;
  label: string;
}

interface ViewSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: ViewOption[];
  dark: boolean;
}

export default function ViewSelect({ value, onChange, options, dark }: ViewSelectProps) {
  const [open, setOpen] = useState(false);
  const [anim, setAnim] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const openFn = () => {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
  };
  const closeFn = () => {
    setAnim(false);
    setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) closeFn(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find(o => o.id === value);
  const accent = dark ? "#68C0A4" : "#1A9E76";
  const accentAlpha = dark ? "rgba(104,192,164," : "rgba(26,158,118,";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => open ? closeFn() : openFn()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px 5px 13px", borderRadius: 20,
          border: `1px solid ${open ? accent : "var(--border)"}`,
          background: open ? `${accentAlpha}0.1)` : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
          color: "var(--text)", fontSize: 12, cursor: "pointer",
          fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap",
          transition: "border-color .15s, background .15s, box-shadow .15s",
          boxShadow: open ? `0 0 0 3px ${accentAlpha}0.15)` : "none",
          outline: "none",
        }}
      >
        {current?.label ?? "Select…"}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
          style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.5, flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 7px)", right: 0, minWidth: 196,
          background: dark ? "rgba(14,14,22,0.96)" : "rgba(255,255,255,0.97)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"}`,
          borderRadius: 14,
          boxShadow: dark
            ? "0 20px 56px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 12px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          zIndex: 400, overflow: "hidden",
          opacity: anim ? 1 : 0,
          transform: anim ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.94)",
          transformOrigin: "top right",
          transition: "opacity 0.15s cubic-bezier(0.4,0,0.2,1), transform 0.15s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: anim ? "auto" : "none",
        }}>
          <div style={{ padding: "5px" }}>
            {options.map(o => {
              const active = o.id === value;
              return (
                <div
                  key={o.id}
                  onMouseDown={e => { e.preventDefault(); onChange(o.id); closeFn(); }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = active ? `${accentAlpha}0.14)` : "transparent"; }}
                  style={{
                    padding: "7px 10px", borderRadius: 9, fontSize: 12,
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 8, userSelect: "none",
                    background: active ? `${accentAlpha}0.14)` : "transparent",
                    color: active ? accent : "var(--text)",
                    fontWeight: active ? 600 : 400,
                    transition: "background .1s",
                  }}
                >
                  {o.label}
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
