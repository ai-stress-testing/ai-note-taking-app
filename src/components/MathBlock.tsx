import { useLayoutEffect, useMemo, useRef } from "react";
import katex from "katex";

/**
 * Renders LaTeX (from `/math`) via KaTeX. `throwOnError: false` makes KaTeX
 * render invalid syntax as an inline highlighted error span instead of
 * throwing; the try/catch below is belt-and-suspenders for anything that
 * still throws (unexpected KaTeX internal errors) — this must never take
 * the editor down. Color comes from `currentColor` so it reads in both
 * Catppuccin light and dark.
 */
export function MathBlock({
  latex,
  onHeightChange,
}: {
  latex: string;
  onHeightChange?: (heightPx: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { html, failed } = useMemo(() => {
    try {
      return {
        html: katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
          strict: "ignore",
        }),
        failed: false,
      };
    } catch {
      return { html: "", failed: true };
    }
  }, [latex]);

  useLayoutEffect(() => {
    if (wrapRef.current) onHeightChange?.(wrapRef.current.offsetHeight);
  }, [html, failed, onHeightChange]);

  if (failed) {
    return (
      <div ref={wrapRef} className="ed-math-block ed-math-error">
        <div className="ed-math-error-hint">couldn't render — showing source</div>
        <code>{latex}</code>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="ed-math-block"
      // KaTeX's own output — sanitized by KaTeX itself, not user HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
