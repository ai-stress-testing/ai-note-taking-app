import { useEffect, useRef } from "react";

type Layer = {
  cssVar: string;
  fallback: string;
  fillAlpha: number;
  amp: number;
  ampRate: number;
  wavelength: number;
  wlRate: number;
  speed: number;
  phase: number;
  lift: number;
};

const LAYERS: Layer[] = [
  {
    cssVar: "--ctp-sapphire",
    fallback: "#74c7ec",
    fillAlpha: 0.05,
    amp: 16,
    ampRate: 0.00013,
    wavelength: 460,
    wlRate: 0.00008,
    speed: 0.00016,
    phase: 0,
    lift: 38,
  },
  {
    cssVar: "--ctp-lavender",
    fallback: "#b4befe",
    fillAlpha: 0.07,
    amp: 13,
    ampRate: 0.00011,
    wavelength: 320,
    wlRate: 0.00006,
    speed: -0.00021,
    phase: 2.1,
    lift: 26,
  },
  {
    cssVar: "--ctp-mauve",
    fallback: "#cba6f7",
    fillAlpha: 0.09,
    amp: 11,
    ampRate: 0.00017,
    wavelength: 250,
    wlRate: 0.0001,
    speed: 0.00027,
    phase: 4.4,
    lift: 15,
  },
];

function rgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(180, 190, 254, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function AmbientWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const colors = LAYERS.map((l) => rootStyle.getPropertyValue(l.cssVar).trim() || l.fallback);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let width = 0;
    let height = 0;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      LAYERS.forEach((l, i) => {
        const amp = l.amp * (1 + 0.4 * Math.sin(t * l.ampRate + l.phase));
        const wl = l.wavelength * (1 + 0.25 * Math.sin(t * l.wlRate + l.phase * 1.7));
        const freq = (Math.PI * 2) / wl;
        const baseline = height - l.lift;
        const y = (x: number) => baseline - amp * Math.sin(x * freq + l.phase + t * l.speed);
        ctx.beginPath();
        ctx.moveTo(0, y(0));
        for (let x = 3; x <= width + 3; x += 3) ctx.lineTo(x, y(x));
        if (i === LAYERS.length - 1) {
          ctx.strokeStyle = rgba(colors[i], 0.22);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = rgba(colors[i], l.fillAlpha);
        ctx.fill();
      });
    };

    const frame = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (reduced || raf) return;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) draw(0);
    });
    observer.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const fade = "linear-gradient(to top, black 45%, transparent)";
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: 110,
        pointerEvents: "none",
        // Sits over the opaque pane backgrounds as a translucent wash
        // (fills are ≤ 0.09 alpha), the way Gemini's workspace glow does.
        zIndex: 2,
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    />
  );
}
