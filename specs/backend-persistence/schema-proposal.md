# SQL schema proposal — for approval

> This supersedes the `cards`/`card_reviews`/`tags`/`card_tags` sketch in
> `data-model-brainstorm.md` with the shape that actually fell out of
> implementing `/question` + the `question_to_card` MCP tool: **a card has
> exactly one question and exactly one part, but one-or-more choices and
> one-or-more marked-correct answers.** `folders`/`files`/`canvases`/
> `blobs`/`auth_tokens` from `design.md` are unchanged and not repeated
> here. Nothing in this file is implemented yet — flag anything you'd
> change before it becomes the real migration.

## Why a card looks like this

A `/question` block is one shared prompt (`Q:`) with one or more lettered
parts, each with its own choices:

```
── Question ──────────────────────────────────────
Q: What is the capital of France?
Part a:
  [x] Paris
  [ ] Berlin
  [ ] Rome
  [ ] Madrid
```

Closing a part is what becomes a reviewable card — so a card is: **one
question** (the shared prompt), **one part** (which lettered section this
card came from), **one-or-more choices** (however many the author left),
and **one-or-more answers** (however many they marked `[x]` — supports
single-answer and select-many MCQs the same way). This is exactly the
input/output shape `mcp-server/question-to-card.ts` already implements
and has been tested against.

## Tables

```sql
create table cards (
  id text primary key,
  kind text not null,                -- 'question' | 'vocab' | 'note'
  file_id text not null references files(id),

  -- kind = 'question': the shared prompt + which lettered part this row is.
  question_ct text,
  question_nonce text,
  part_label text,                   -- 'a' | 'b' | ...

  -- kind = 'vocab' (front=term, back=definition) / 'note' (front=body only)
  front_ct text,
  front_nonce text,
  back_ct text,
  back_nonce text,

  created_at integer not null,
  updated_at integer not null,

  -- FSRS scheduling state — plaintext; "what's due" runs as a WHERE clause.
  fsrs_stability real,
  fsrs_difficulty real,
  fsrs_due_at integer,
  fsrs_reps integer not null default 0,
  fsrs_lapses integer not null default 0,

  -- grading — plaintext boolean (aiVerified from the MCP tool), encrypted summary.
  graded_correct integer,
  graded_summary_ct text,
  graded_summary_nonce text,
  flagged integer not null default 0
);

-- Only populated for kind = 'question'. One-or-more rows per card.
create table card_choices (
  id integer primary key autoincrement,
  card_id text not null references cards(id),
  order_index integer not null,      -- preserves on-screen order
  choice_ct text not null,
  choice_nonce text not null
);

-- Which choice(s) are correct. One-or-more rows per question card.
create table card_answers (
  card_id text not null references cards(id),
  choice_id integer not null references card_choices(id),
  primary key (card_id, choice_id)
);

create table card_reviews (         -- append-only FSRS review history
  id integer primary key autoincrement,
  card_id text not null references cards(id),
  rating text not null,             -- again | hard | good | easy
  reviewed_at integer not null,
  stability_after real,
  difficulty_after real
);

create table tags (
  id integer primary key autoincrement,
  name_ct text not null,
  name_nonce text not null
);

create table card_tags (
  card_id text not null references cards(id),
  tag_id integer not null references tags(id),
  primary key (card_id, tag_id)
);
```

`choice_ct`/`choice_nonce` are encrypted (a choice's text is content, same
rule as everywhere else in this schema: free text encrypted, metadata
plaintext). `order_index` and the `card_answers` join rows are plaintext
— they're structure, not content.

## Decisions this makes, flagged for approval

1. **Question text is denormalized across a multi-part question's cards**,
   not pulled into a separate `questions` table with a `question_id` FK.
   Every part of the same question repeats `question_ct` on its own card
   row. Simpler (no join, no extra table, matches how the app itself
   stores it — one shared `Q:` line in one buffer, not a normalized
   record) at the cost of the same ciphertext existing N times for an
   N-part question. **Alternative considered**: a `questions` table
   (`id`, `question_ct`, `question_nonce`, `file_id`) with `cards.
   question_id` replacing `cards.question_ct`/`question_nonce` directly —
   avoids duplication, costs a join on every read. Recommend the
   denormalized version above unless duplication turns out to matter in
   practice.
2. **`card_choices`/`card_answers` are separate tables from `cards`**,
   not, say, a JSON array column on `cards`. Keeps the "1-or-more" a real
   one-to-many relationship SQL can enforce referentially (a `card_answers`
   row can't reference a choice that doesn't exist) rather than an opaque
   blob the app has to parse and trust.
3. **Cardinality ("1-or-more") isn't enforced by the schema itself.**
   SQLite can't cheaply express "at least one child row" as a table-level
   constraint without a trigger. This proposal leaves that as an
   application-level invariant (the `/question` UI always inserts ≥1
   choice line; the MCP tool's `z.array().min(1)` already validates it at
   the boundary) rather than adding `CREATE TRIGGER` machinery for a rule
   the app's own insert path already guarantees. Worth a second look if
   this backend ever gets a second, less-trusted writer.
4. **`kind='vocab'`/`kind='note'` cards leave `question_ct`, `part_label`,
   and all `card_choices`/`card_answers` rows absent** (no choices table
   rows, null question/part columns) — they use `front_ct`/`back_ct`
   instead. A `CHECK` constraint tying which columns must be
   non-null per `kind` is possible but adds real complexity for what's
   currently just two shapes; flagged rather than built.

## Open questions

- Whether `card_choices.order_index` needs to be renumbered on
  choice-deletion (if choices can ever be removed after creation) or
  whether gaps are fine since ordering only needs to be stable, not dense.
- Whether an MCQ with exactly one marked answer should be modeled any
  differently from one with several (today: no, `card_answers` just has
  1 row vs. several — same shape either way).
