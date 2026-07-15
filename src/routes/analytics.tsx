import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, fmtDuration } from "@/lib/store";
import { RATING_LABELS, type FsrsRating } from "@/lib/fsrs";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "NeuroVim — Analytics" }] }),
  component: AnalyticsPage,
});

const DAY_MS = 86_400_000;

function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function Bar({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
}) {
  return (
    <div className="an-bar-row">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="an-bar-detail">{detail}</span>
    </div>
  );
}

function AnalyticsPage() {
  const { sessionEvents, cards, reviewLogs } = useStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const stats = useMemo(() => {
    // Work intervals from the session log, attributed to their start day.
    const workByDay = new Map<string, number>();
    let workingSince: number | null = null;
    let totalWork = 0;
    let totalBreak = 0;
    let breakSince: number | null = null;
    for (const e of sessionEvents) {
      if (e.type === "start" || e.type === "resume") {
        if (breakSince !== null) {
          totalBreak += e.at - breakSince;
          breakSince = null;
        }
        workingSince = e.at;
      } else if (e.type === "break" || e.type === "end") {
        if (workingSince !== null) {
          const d = e.at - workingSince;
          totalWork += d;
          workByDay.set(dayKey(workingSince), (workByDay.get(dayKey(workingSince)) ?? 0) + d);
          workingSince = null;
        }
        if (e.type === "break") breakSince = e.at;
        else if (breakSince !== null) {
          totalBreak += e.at - breakSince;
          breakSince = null;
        }
      }
    }

    const reviewsByDay = new Map<string, number>();
    const ratingCounts = new Map<FsrsRating, number>();
    for (const r of reviewLogs) {
      reviewsByDay.set(dayKey(r.reviewedAt), (reviewsByDay.get(dayKey(r.reviewedAt)) ?? 0) + 1);
      ratingCounts.set(r.rating, (ratingCounts.get(r.rating) ?? 0) + 1);
    }

    const all = Object.values(cards);
    const now = Date.now();
    const graded = all.filter((c) => c.gradedCorrect !== undefined);
    const tagCounts = new Map<string, number>();
    for (const c of all)
      for (const t of c.gradedTags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

    const days: { key: string; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const at = now - i * DAY_MS;
      days.push({
        key: dayKey(at),
        label: new Date(at).toLocaleDateString([], { month: "short", day: "numeric" }),
      });
    }

    return {
      totalWork,
      totalBreak,
      days,
      workByDay,
      reviewsByDay,
      ratingCounts,
      totalCards: all.length,
      dueNow: all.filter((c) => c.fsrs.dueAt <= now).length,
      flagged: all.filter((c) => c.flagged).length,
      reviewsTotal: reviewLogs.length,
      gradedTotal: graded.length,
      gradedOk: graded.filter((c) => c.gradedCorrect).length,
      topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [sessionEvents, cards, reviewLogs]);

  if (!hydrated) return <div className="an-page" />;

  const maxWork = Math.max(...stats.days.map((d) => stats.workByDay.get(d.key) ?? 0), 1);
  const maxReviews = Math.max(...stats.days.map((d) => stats.reviewsByDay.get(d.key) ?? 0), 1);
  const maxRating = Math.max(
    ...[1, 2, 3, 4].map((r) => stats.ratingCounts.get(r as FsrsRating) ?? 0),
    1,
  );
  const maxTag = Math.max(...stats.topTags.map(([, n]) => n), 1);

  return (
    <div className="an-page">
      <header className="an-head">
        <Link to="/" className="an-back">
          ← editor
        </Link>
        <h1>analytics</h1>
        <span className="an-privacy" title="This page is a local view over your own data.">
          computed locally · never sent to AI
        </span>
      </header>

      <section className="an-tiles">
        <div className="an-tile">
          <span className="n">{fmtDuration(stats.totalWork)}</span>
          <span className="l">focused, all time</span>
        </div>
        <div className="an-tile">
          <span className="n">{fmtDuration(stats.totalBreak)}</span>
          <span className="l">on break</span>
        </div>
        <div className="an-tile">
          <span className="n">{stats.totalCards}</span>
          <span className="l">
            cards ({stats.dueNow} due, {stats.flagged} flagged)
          </span>
        </div>
        <div className="an-tile">
          <span className="n">{stats.reviewsTotal}</span>
          <span className="l">reviews logged</span>
        </div>
      </section>

      <section className="an-section">
        <h2>focus · last 14 days</h2>
        {stats.days.map((d) => (
          <Bar
            key={d.key}
            label={d.label}
            value={stats.workByDay.get(d.key) ?? 0}
            max={maxWork}
            detail={fmtDuration(stats.workByDay.get(d.key) ?? 0)}
          />
        ))}
      </section>

      <section className="an-section">
        <h2>reviews · last 14 days</h2>
        {stats.days.map((d) => (
          <Bar
            key={d.key}
            label={d.label}
            value={stats.reviewsByDay.get(d.key) ?? 0}
            max={maxReviews}
            detail={String(stats.reviewsByDay.get(d.key) ?? 0)}
          />
        ))}
      </section>

      <section className="an-section">
        <h2>ratings</h2>
        {([1, 2, 3, 4] as FsrsRating[]).map((r) => (
          <Bar
            key={r}
            label={RATING_LABELS[r]}
            value={stats.ratingCounts.get(r) ?? 0}
            max={maxRating}
            detail={String(stats.ratingCounts.get(r) ?? 0)}
          />
        ))}
      </section>

      <section className="an-section">
        <h2>question grading</h2>
        {stats.gradedTotal === 0 ? (
          <p className="an-empty">No graded questions yet — close a /question block with /&gt;.</p>
        ) : (
          <>
            <Bar
              label="verified"
              value={stats.gradedOk}
              max={stats.gradedTotal}
              detail={`${stats.gradedOk} / ${stats.gradedTotal}`}
            />
            <Bar
              label="check answers"
              value={stats.gradedTotal - stats.gradedOk}
              max={stats.gradedTotal}
              detail={String(stats.gradedTotal - stats.gradedOk)}
            />
          </>
        )}
      </section>

      <section className="an-section">
        <h2>top tags</h2>
        {stats.topTags.length === 0 ? (
          <p className="an-empty">Tags appear here once questions are graded.</p>
        ) : (
          stats.topTags.map(([tag, n]) => (
            <Bar key={tag} label={tag} value={n} max={maxTag} detail={String(n)} />
          ))
        )}
      </section>
    </div>
  );
}
