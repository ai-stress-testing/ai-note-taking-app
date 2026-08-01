import { useMemo, useState } from "react";
import { useStore, type Card, type CardChoice } from "@/lib/store";

type FilterKey = "all" | "due" | "flagged" | "question" | "card" | "note";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "all" },
  { key: "due", label: "due now" },
  { key: "flagged", label: "flagged" },
  { key: "question", label: "question" },
  { key: "card", label: "card" },
  { key: "note", label: "note" },
];

function cardText(card: Card): string {
  return (card.kind === "question" ? card.question : card.front) || "(empty)";
}

function fmtDue(at: number, now: number): string {
  if (at <= now) return "due now";
  const days = Math.round((at - now) / 86_400_000);
  if (days < 1) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 30) return `due in ${days}d`;
  return `due ${new Date(at).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

type EditState = {
  front: string;
  back: string;
  encoding: string;
  question: string;
  choices: CardChoice[];
};

function toEditState(card: Card): EditState {
  return {
    front: card.front ?? "",
    back: card.back ?? "",
    encoding: card.encoding ?? "",
    question: card.question ?? "",
    choices: (card.choices ?? []).map((c) => ({ ...c })),
  };
}

export function CardManagement() {
  const { cards, files, toggleCardFlag, deleteCard, updateCard } = useStore();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const list = useMemo(() => {
    const all = Object.values(cards);
    const filtered = all.filter((c) => {
      switch (filter) {
        case "due":
          return c.fsrs.dueAt <= now;
        case "flagged":
          return c.flagged;
        case "question":
        case "card":
        case "note":
          return c.kind === filter;
        default:
          return true;
      }
    });
    return filtered.sort((a, b) => a.fsrs.dueAt - b.fsrs.dueAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filter]);

  const patchEdit = (patch: Partial<EditState>) => {
    setEdit((e) => (e ? { ...e, ...patch } : e));
    setError(null);
  };
  const patchChoice = (i: number, patch: Partial<CardChoice>) => {
    setEdit((e) =>
      e ? { ...e, choices: e.choices.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) } : e,
    );
    setError(null);
  };
  const addChoice = () => {
    setEdit((e) => (e ? { ...e, choices: [...e.choices, { text: "", correct: false }] } : e));
    setError(null);
  };
  const removeChoice = (i: number) => {
    setEdit((e) =>
      e && e.choices.length > 1 ? { ...e, choices: e.choices.filter((_, idx) => idx !== i) } : e,
    );
    setError(null);
  };

  const startEdit = (card: Card) => {
    setEditingId(card.id);
    setEdit(toEditState(card));
    setError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
    setError(null);
  };

  const saveEdit = (card: Card) => {
    if (!edit) return;
    if (card.kind === "question") {
      const question = edit.question.trim();
      if (!question) return setError("Question text can't be empty.");
      const choices = edit.choices
        .map((c) => ({ text: c.text.trim(), correct: c.correct }))
        .filter((c) => c.text.length > 0);
      if (choices.length === 0) return setError("Keep at least one choice.");
      if (!choices.some((c) => c.correct)) return setError("Mark at least one choice correct.");
      updateCard(card.id, { question, choices });
    } else {
      const front = edit.front.trim();
      if (!front) return setError("Front text can't be empty.");
      updateCard(card.id, {
        front,
        back: edit.back.trim() || undefined,
        encoding: edit.encoding.trim() || undefined,
      });
    }
    cancelEdit();
  };

  const onDelete = (card: Card) => {
    if (!confirm(`Delete this ${card.kind}? This can't be undone.`)) return;
    if (editingId === card.id) cancelEdit();
    deleteCard(card.id);
  };

  return (
    <section className="an-section an-cm">
      <h2>manage cards</h2>
      <div className="an-cm-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`an-cm-chip ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="an-empty">No cards match this filter.</p>
      ) : (
        <ul className="an-cm-list">
          {list.map((card) => {
            const isEditing = editingId === card.id;
            const fileName = card.fileId ? files[card.fileId]?.name : undefined;
            return (
              <li key={card.id} className="an-cm-row">
                <div className="an-cm-row-main">
                  <span className={`an-cm-kind k-${card.kind}`}>{card.kind}</span>
                  <span className="an-cm-text">{cardText(card)}</span>
                  <span className="an-cm-due">{fmtDue(card.fsrs.dueAt, now)}</span>
                  {fileName && <span className="an-cm-file">{fileName}</span>}
                  <button
                    className={`ed-fc-flag ${card.flagged ? "on" : ""}`}
                    onClick={() => toggleCardFlag(card.id)}
                    title={card.flagged ? "Unflag" : "Flag: source content may be outdated"}
                    aria-pressed={card.flagged}
                  >
                    ⚑
                  </button>
                  <button
                    className="ed-btn ghost"
                    onClick={() => (isEditing ? cancelEdit() : startEdit(card))}
                  >
                    {isEditing ? "cancel" : "edit"}
                  </button>
                  <button className="ed-btn ghost an-cm-del" onClick={() => onDelete(card)}>
                    delete
                  </button>
                </div>
                {isEditing && edit && (
                  <div className="an-cm-edit">
                    {card.kind === "question" ? (
                      <>
                        <label className="an-cm-field">
                          <span>question</span>
                          <textarea
                            value={edit.question}
                            onChange={(e) => patchEdit({ question: e.target.value })}
                          />
                        </label>
                        <div className="an-cm-choices">
                          {edit.choices.map((c, i) => (
                            <div key={i} className="an-cm-choice-row">
                              <input
                                type="checkbox"
                                checked={c.correct}
                                onChange={(e) => patchChoice(i, { correct: e.target.checked })}
                                title="Correct answer"
                              />
                              <input
                                type="text"
                                value={c.text}
                                onChange={(e) => patchChoice(i, { text: e.target.value })}
                                placeholder="choice text"
                              />
                              <button
                                className="ed-btn ghost"
                                onClick={() => removeChoice(i)}
                                disabled={edit.choices.length <= 1}
                              >
                                remove
                              </button>
                            </div>
                          ))}
                          <button className="ed-btn ghost" onClick={addChoice}>
                            + add choice
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="an-cm-field">
                          <span>front</span>
                          <textarea
                            value={edit.front}
                            onChange={(e) => patchEdit({ front: e.target.value })}
                          />
                        </label>
                        <label className="an-cm-field">
                          <span>back (optional)</span>
                          <textarea
                            value={edit.back}
                            onChange={(e) => patchEdit({ back: e.target.value })}
                          />
                        </label>
                        <label className="an-cm-field">
                          <span>encoding (optional)</span>
                          <textarea
                            value={edit.encoding}
                            onChange={(e) => patchEdit({ encoding: e.target.value })}
                          />
                        </label>
                      </>
                    )}
                    {error && <p className="an-cm-error">{error}</p>}
                    <div className="an-cm-edit-actions">
                      <button className="ed-btn ghost" onClick={cancelEdit}>
                        cancel
                      </button>
                      <button className="ed-btn primary" onClick={() => saveEdit(card)}>
                        save
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
