import { useEffect, useMemo, useState } from "react";
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
    </>
  );
}

export function FlashcardTray({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { cards, rateCard, toggleCardFlag } = useStore();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [entering, setEntering] = useState(true);
  const [ratedCount, setRatedCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);

  const queue = useMemo(() => ids.filter((id) => cards[id]), [ids, cards]);
  const [sessionSize] = useState(() => queue.length);
  const dueRemaining = useMemo(
    () => Object.values(cards).filter((c) => c.fsrs.dueAt <= Date.now()).length,
    [cards],
  );
  const card = queue[index] ? cards[queue[index]] : undefined;
  const done = index >= queue.length;

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
    const caughtUp = dueRemaining === 0;
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
              {core} · {dueRemaining} still due
              {againCount > 0 ? ` (${againCount} marked again)` : ""} — /fsrs for more
            </>
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
        <button className="ed-modal-x" onClick={onClose} aria-label="Close review">
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
