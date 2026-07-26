import { useLayoutEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getCaretCoords } from "@/lib/caret";
import {
  CANVAS_MARKER_RE,
  LINE_HEIGHT_PX,
  MATH_MARKER_RE,
  REVIEW_MARKER,
  removeMarkerBlock,
  resizeMarkerBlock,
} from "@/lib/inline-widgets";
import { CanvasBlock } from "./CanvasBlock";
import { FlashcardTray } from "./FlashcardTray";
import { MathBlock } from "./MathBlock";

type Anchor = { x: number; y: number };
type MathAnchor = Anchor & { marker: string; latex: string };

/**
 * Renders canvases and the review tray at the exact line where /canvas and
 * /fsrs were invoked: markers in the buffer reserve vertical space; this
 * layer measures each marker's pixel position (same mirror technique the
 * slash menu uses) and absolutely positions the widget over the reserved
 * lines, inside the scrolling text flow.
 */
export function InlineWidgetLayer({
  fileId,
  content,
  textarea,
  focused,
  reviewIds,
  onCloseReview,
  onContinueReview,
}: {
  fileId: string;
  content: string;
  textarea: HTMLTextAreaElement | null;
  focused: boolean;
  reviewIds: string[] | null;
  onCloseReview: () => void;
  onContinueReview: () => void;
}) {
  const { canvases, setCanvas, deleteCanvas, setContent } = useStore();
  const [anchors, setAnchors] = useState<Record<string, Anchor>>({});
  const [mathAnchors, setMathAnchors] = useState<MathAnchor[]>([]);
  const [tick, setTick] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!textarea) return;
    const observer = new ResizeObserver(() => setTick((t) => t + 1));
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [textarea]);

  // Anchors below are stored as raw, scroll-independent offsets (document
  // position, not viewport position). Live scroll is tracked separately here
  // so repositioning on scroll is cheap arithmetic, not a DOM re-measurement.
  useLayoutEffect(() => {
    if (!textarea) return;
    setScroll({ top: textarea.scrollTop, left: textarea.scrollLeft });
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScroll({ top: textarea.scrollTop, left: textarea.scrollLeft });
      });
    };
    textarea.addEventListener("scroll", onScroll);
    return () => {
      textarea.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [textarea]);

  useLayoutEffect(() => {
    if (!textarea) return;
    const next: Record<string, Anchor> = {};
    for (const m of content.matchAll(CANVAS_MARKER_RE)) {
      const { x, y } = getCaretCoords(textarea, m.index);
      next[m[1]] = {
        x: x + textarea.scrollLeft,
        y: y + textarea.scrollTop + LINE_HEIGHT_PX + 4,
      };
    }
    const reviewIdx = content.indexOf(REVIEW_MARKER);
    if (reviewIdx !== -1) {
      const { x, y } = getCaretCoords(textarea, reviewIdx);
      next["review"] = {
        x: x + textarea.scrollLeft,
        y: y + textarea.scrollTop + LINE_HEIGHT_PX + 4,
      };
    }
    setAnchors(next);
    const nextMath: MathAnchor[] = [];
    for (const m of content.matchAll(MATH_MARKER_RE)) {
      const { x, y } = getCaretCoords(textarea, m.index);
      nextMath.push({
        marker: m[0],
        latex: m[2],
        x: x + textarea.scrollLeft,
        y: y + textarea.scrollTop + LINE_HEIGHT_PX + 4,
      });
    }
    setMathAnchors(nextMath);
    // tick re-measures on pane resize (wrapping changes line positions)
  }, [content, textarea, tick]);

  const fileCanvases = canvases[fileId] ?? [];

  return (
    <>
      {fileCanvases.map((cv) => {
        const a = anchors[cv.id];
        if (!a) return null;
        return (
          <div
            key={cv.id}
            className="ed-inline-widget"
            style={{
              position: "absolute",
              top: a.y - scroll.top,
              left: a.x - scroll.left,
              zIndex: 3,
            }}
          >
            <CanvasBlock
              data={cv}
              onChange={(next) => {
                setCanvas(fileId, { ...cv, ...next });
                if (next.height !== cv.height) {
                  setContent(
                    fileId,
                    resizeMarkerBlock(content, `⟦canvas:${cv.id}⟧`, next.height + 40),
                  );
                }
              }}
              onDelete={() => {
                deleteCanvas(fileId, cv.id);
                setContent(fileId, removeMarkerBlock(content, `⟦canvas:${cv.id}⟧`));
              }}
            />
          </div>
        );
      })}
      {focused && reviewIds && anchors["review"] && (
        <div
          className="ed-inline-widget ed-inline-review"
          style={{
            position: "absolute",
            top: anchors["review"].y - scroll.top,
            left: anchors["review"].x - scroll.left,
            right: "1.25rem",
            zIndex: 3,
          }}
        >
          <FlashcardTray
            ids={reviewIds}
            onClose={() => {
              setContent(fileId, removeMarkerBlock(content, REVIEW_MARKER));
              onCloseReview();
            }}
            onContinue={onContinueReview}
          />
        </div>
      )}
      {mathAnchors.map((a) => (
        <div
          key={a.marker}
          className="ed-inline-widget"
          style={{
            position: "absolute",
            top: a.y - scroll.top,
            left: a.x - scroll.left,
            zIndex: 3,
          }}
        >
          <MathBlock
            latex={a.latex}
            onHeightChange={(heightPx) => {
              const cur = useStore.getState().files[fileId]?.content ?? content;
              const resized = resizeMarkerBlock(cur, a.marker, heightPx + 16);
              if (resized !== cur) setContent(fileId, resized);
            }}
          />
        </div>
      ))}
    </>
  );
}
