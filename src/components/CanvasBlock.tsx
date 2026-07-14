import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

type Point = { x: number; y: number; p: number };
type Stroke = { points: Point[]; color: string; width: number };

export type CanvasBlockData = {
  id: string;
  strokes: Stroke[];
  width: number;
  height: number;
};

const INK = "#cba6f7"; // Catppuccin mauve

export function CanvasBlock({
  data,
  onChange,
  onDelete,
}: {
  data: CanvasBlockData;
  onChange: (next: CanvasBlockData) => void;
  onDelete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pencil" | "mouse">("pencil");

  // Redraw whenever strokes or size change.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(data.width * dpr);
    c.height = Math.floor(data.height * dpr);
    c.style.width = `${data.width}px`;
    c.style.height = `${data.height}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, data.width, data.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    for (const s of data.strokes) {
      drawStroke(ctx, s);
    }
    if (drawingRef.current) drawStroke(ctx, drawingRef.current);
  }, [data.strokes, data.width, data.height]);

  // Watch container size for user resize.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      // Only report meaningful deltas so we don't loop.
      const newW = Math.max(120, Math.round(rect.width - 2));
      const newH = Math.max(80, Math.round(rect.height - 34)); // minus toolbar
      if (newW !== data.width || newH !== data.height) {
        onChange({ ...data, width: newW, height: newH });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, onChange]);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Enforce input type based on tool.
    if (tool === "pencil" && e.pointerType !== "pen") {
      // Allow touch as pencil too, block mouse.
      if (e.pointerType !== "touch") return;
    }
    if (tool === "mouse" && e.pointerType !== "mouse") return;

    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const p: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure > 0 ? e.pressure : 0.5,
    };
    drawingRef.current = {
      color: INK,
      width: tool === "pencil" ? 1.4 : 2.2,
      points: [p],
    };
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingRef.current.points.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure > 0 ? e.pressure : 0.5,
    });
    // Incremental draw (last segment only for smoothness)
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawSegment(ctx, drawingRef.current);
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const finished = drawingRef.current;
    drawingRef.current = null;
    onChange({ ...data, strokes: [...data.strokes, finished] });
  };

  const clear = () => onChange({ ...data, strokes: [] });
  const undo = () => onChange({ ...data, strokes: data.strokes.slice(0, -1) });

  return (
    <div
      ref={wrapRef}
      className="ed-canvas"
      style={{ width: data.width + 2, height: data.height + 34 }}
    >
      <div className="ed-canvas-toolbar">
        <span className="ed-canvas-label">canvas · purple ink</span>
        <div className="ed-canvas-tools">
          <button
            className={`ed-canvas-tool ${tool === "pencil" ? "on" : ""}`}
            onClick={() => setTool("pencil")}
            title="Mechanical pencil (stylus / touch)"
          >✎</button>
          <button
            className={`ed-canvas-tool ${tool === "mouse" ? "on" : ""}`}
            onClick={() => setTool("mouse")}
            title="Mouse"
          >☍</button>
          <span className="ed-canvas-sep" />
          <button className="ed-canvas-tool" onClick={undo} title="Undo last stroke">↶</button>
          <button className="ed-canvas-tool" onClick={clear} title="Clear canvas">⌫</button>
          <button className="ed-canvas-tool danger" onClick={onDelete} title="Remove canvas">×</button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="ed-canvas-surface"
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
      />
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) {
    const p = s.points[i];
    ctx.lineWidth = s.width * (0.6 + p.p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
}
function drawSegment(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length < 2) return;
  const a = s.points[s.points.length - 2];
  const b = s.points[s.points.length - 1];
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width * (0.6 + b.p);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Convenience hook to work with the current file's canvas list. */
export function useFileCanvases(fileId: string | undefined) {
  const canvases = useStore((s) => s.canvases);
  const setCanvas = useStore((s) => s.setCanvas);
  const deleteCanvas = useStore((s) => s.deleteCanvas);
  const list = fileId ? (canvases[fileId] ?? []) : [];
  return { list, setCanvas, deleteCanvas };
}
