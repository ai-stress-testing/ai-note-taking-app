import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore, type Card } from "@/lib/store";
import { reviewCard, type FsrsRating } from "@/lib/fsrs";

const RATINGS: { rating: FsrsRating; label: string; keyHint: string }[] = [
  { rating: 1, label: "again", keyHint: "1" },
  { rating: 2, label: "hard", keyHint: "2" },
  { rating: 3, label: "good", keyHint: "3" },
  { rating: 4, label: "easy", keyHint: "4" },
];

function fmtInterval(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days * 10) / 10}d`;
  if (days < 365) return `${Math.round(days / 30.44)}mo`;
  return `${Math.round((days / 365.25) * 10) / 10}y`;
}

function CardFront({ card, revealed }: { card: Card; revealed: boolean }) {
  if (card.kind === "question") {
    return (
      <>
        <div className="ed-fc-q">{card.question}</div>
        {card.partLabel && <div className="ed-fc-part">part {card.partLabel}</div>}
        <div className="ed-fc-choices">
          {(card.choices ?? []).map((c, i) => (
            <div
              key={i}
              className={`ed-fc-choice ${revealed ? (c.correct ? "correct" : "wrong") : ""}`}
            >
              <span className="box">{revealed && c.correct ? "✓" : ""}</span>
              {c.text}
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="ed-fc-q">{card.front}</div>
      {revealed && card.back && <div className="ed-fc-back">{card.back}</div>}
      {revealed && card.encoding && <div className="ed-fc-encoding">encoding: {card.encoding}</div>}
    </>
  );
}

/**
 * Same due-card rule `/fsrs` uses to build a review batch: due now, oldest
 * first, capped at 10. Shared by `startReview` (routes/index.tsx) and the
 * "continue" button below so both pick the next batch identically instead
 * of duplicating the filter/sort/slice.
 */
export function pickDueCards(cards: Record<string, Card>, cap = 10): Card[] {
  const now = Date.now();
  return Object.values(cards)
    .filter((c) => c.fsrs.dueAt <= now)
    .sort((a, b) => a.fsrs.dueAt - b.fsrs.dueAt)
    .slice(0, cap);
}

/**
 * Batch ownership lives at the route (`reviewIds`): "continue" swaps in the
 * next due batch there, so a tray remount (pane refocus, a second /fsrs)
 * always re-seeds the CURRENT batch instead of a stale first one. Keying
 * ReviewSession by the batch identity remounts it with fresh per-session
 * counters when the batch changes.
 */
export function FlashcardTray({
  ids,
  onClose,
  onContinue,
}: {
  ids: string[];
  onClose: () => void;
  onContinue?: () => void;
}) {
  const { cards } = useStore();

  const dueRemaining = useMemo(
    () => Object.values(cards).filter((c) => c.fsrs.dueAt <= Date.now()).length,
    [cards],
  );

  return (
    <ReviewSession
      key={ids.join(",")}
      ids={ids}
      dueRemaining={dueRemaining}
      onClose={onClose}
      onContinue={onContinue}
    />
  );
}

function ReviewSession({
  ids,
  dueRemaining,
  onClose,
  onContinue,
}: {
  ids: string[];
  dueRemaining: number;
  onClose: () => void;
  onContinue?: () => void;
}) {
  const { cards, rateCard, toggleCardFlag } = useStore();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [entering, setEntering] = useState(true);
  const [ratedCount, setRatedCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);

  const queue = useMemo(() => ids.filter((id) => cards[id]), [ids, cards]);
  const [sessionSize] = useState(() => queue.length);
  const card = queue[index] ? cards[queue[index]] : undefined;
  const done = index >= queue.length;

  // Early close (× before the queue is exhausted) must still report the
  // honest partial count — otherwise closing mid-session silently drops it.
  const closeWithSummary = () => {
    if (!done && ratedCount > 0) toast(`${ratedCount} of ${sessionSize} reviewed`);
    onClose();
  };

  const advance = () => {
    setRevealed(false);
    setEntering(false);
    // Restart the enter transition on the next card; motion is 160ms and
    // never gates input — rating buttons work mid-transition.
    requestAnimationFrame(() => {
      setIndex((i) => i + 1);
      setEntering(true);
    });
  };

  const rate = (rating: FsrsRating) => {
    if (!card) return;
    rateCard(card.id, rating);
    setRatedCount((n) => n + 1);
    if (rating === 1) setAgainCount((n) => n + 1);
    advance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key) as FsrsRating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    // "again" cards are rescheduled ~10 min out, so they leave dueRemaining
    // (a <= now filter) — caught-up must also require none were marked again,
    // or an all-"again" session would falsely claim completion.
    const caughtUp = dueRemaining === 0 && againCount === 0;
    const core =
      ratedCount === sessionSize
        ? `${ratedCount} reviewed`
        : `${ratedCount} of ${sessionSize} reviewed`;
    return (
      <div className="ed-fc-tray" role="region" aria-label="Review session">
        <div className="ed-fc-done">
          {caughtUp ? (
            <>
              <span className="ed-fc-done-mark">✓</span> caught up · {core}
            </>
          ) : (
            <>
              {core}
              {dueRemaining > 0 ? ` · ${dueRemaining} still due` : ""}
              {againCount > 0 ? ` · ${againCount} marked again` : ""}
              {dueRemaining === 0 ? " — /fsrs for more" : ""}
            </>
          )}
          {dueRemaining > 0 && onContinue && (
            <button className="ed-btn primary" onClick={onContinue}>
              continue
            </button>
          )}
          <button className="ed-btn ghost" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    );
  }
  if (!card) return null;

  return (
    <div className="ed-fc-tray" role="region" aria-label="Review session">
      <div className="ed-fc-head">
        <span className="ed-fc-kind">{card.kind}</span>
        {card.gradedCorrect !== undefined && (
          <span className={`ed-fc-graded ${card.gradedCorrect ? "ok" : "bad"}`}>
            {card.gradedCorrect ? "verified" : "check answers"}
          </span>
        )}
        <span className="ed-fc-progress">
          {index + 1} / {queue.length}
        </span>
        <button
          className={`ed-fc-flag ${card.flagged ? "on" : ""}`}
          onClick={() => toggleCardFlag(card.id)}
          title={card.flagged ? "Unflag" : "Flag: source content may be outdated"}
          aria-pressed={card.flagged}
        >
          ⚑
        </button>
        <button className="ed-modal-x" onClick={closeWithSummary} aria-label="Close review">
          ×
        </button>
      </div>
      <div className={`ed-fc-card ${entering ? "in" : ""}`}>
        <CardFront card={card} revealed={revealed} />
      </div>
      <div className="ed-fc-actions">
        {!revealed ? (
          <button className="ed-btn primary" onClick={() => setRevealed(true)}>
            show answer <kbd>space</kbd>
          </button>
        ) : (
          RATINGS.map(({ rating, label, keyHint }) => (
            <button
              key={rating}
              className={`ed-btn ed-fc-rate r${rating}`}
              onClick={() => rate(rating)}
              title={`Rate ${label}`}
            >
              {label}{" "}
              <span className="ivl">
                {fmtInterval(reviewCard(card.fsrs, rating).log.scheduledDays)}
              </span>
              <kbd>{keyHint}</kbd>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
