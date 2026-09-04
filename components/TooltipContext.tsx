"use client";
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
  visible: boolean;
}

interface TooltipApi {
  show: (x: number, y: number, content: ReactNode) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

const TooltipCtx = createContext<TooltipApi | null>(null);

export function useTooltip(): TooltipApi {
  const ctx = useContext(TooltipCtx);
  if (!ctx) throw new Error("useTooltip must be used within TooltipProvider");
  return ctx;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TooltipState>({ x: 0, y: 0, content: null, visible: false });
  const frame = useRef<number | null>(null);

  const show = useCallback((x: number, y: number, content: ReactNode) => {
    setState({ x, y, content, visible: true });
  }, []);
  const move = useCallback((x: number, y: number) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setState((s) => (s.visible ? { ...s, x, y } : s));
    });
  }, []);
  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  return (
    <TooltipCtx.Provider value={{ show, move, hide }}>
      {children}
      <div
        className="tooltip"
        style={{
          left: state.x,
          top: state.y - 10,
          opacity: state.visible ? 1 : 0,
        }}
      >
        {state.content}
      </div>
    </TooltipCtx.Provider>
  );
}
