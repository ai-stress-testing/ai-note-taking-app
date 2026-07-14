# Data model brainstorm: cards, tags, grading, analytics

> Exploratory — unlike `design.md`, nothing here is a locked decision yet.
> This extends that document's SQLite schema to cover what
> `specs/cards-and-fsrs-review/`, `specs/question-grading-and-flagging/`,
> and `specs/study-analytics-page/` need. Read `design.md` first — this
> assumes its `folders`/`files`/`canvases`/`blobs` tables and its
> encryption approach (ciphertext + nonce columns, never decryptable
> server-side) as given.

## The one rule this whole brainstorm follows

**Free-text content the user wrote stays encrypted. Classification
metadata (booleans, enums, numbers, foreign keys) stays plaintext.** Not
because plaintext metadata is unimportant, but because the analytics page
(`specs/study-analytics-page/`) needs to run aggregate SQL queries
(counts, group-bys, date-range filters) without decrypting anything —
decryption only happens client-side, and the server can't `GROUP BY` a
column it can't read. Drawing the line at "is this the user's own words,
or a category/number about it" keeps that possible without weakening
R9's actual guarantee: an attacker who gets the DB still can't read what
anyone actually studied, only that *some* card exists, was tagged with an
opaque `tag_id`, and was answered right or wrong.

## Cards: one table, a `kind` discriminator

Question and Vocab are both cards (per R1 in `cards-and-fsrs-review`); a
single table with a `kind` column is simpler than separate `questions` and
`vocab` tables that'd otherwise duplicate every FSRS/review column:

```sql
create table cards (
  id text primary key,
  kind text not null,              -- 'question' | 'vocab' (open to more later)
  file_id text not null references files(id),

  front_ct text not null,          -- the question text / vocab term
  front_nonce text not null,
  back_ct text,                    -- answer / definition; null until known
  back_nonce text,

  created_at integer not null,
  updated_at integer not null,

  -- FSRS scheduling state (cards-and-fsrs-review R2) — plaintext:
  -- the "what's due" query needs to run as a server-side WHERE clause.
  fsrs_stability real,
  fsrs_difficulty real,
  fsrs_due_at integer,
  fsrs_reps integer not null default 0,
  fsrs_lapses integer not null default 0,

  -- grading (question-grading-and-flagging R1-R2) — kind='question' only
  graded_correct integer,          -- 0/1/null; plaintext, see "one rule" above
  graded_summary_ct text,          -- the 1-sentence principle summary; encrypted
  graded_summary_nonce text,
  flagged integer not null default 0   -- R3; plaintext, it's just a marker
);

create table card_reviews (        -- append-only FSRS review history
  id integer primary key autoincrement,
  card_id text not null references cards(id),
  rating text not null,            -- again | hard | good | easy
  reviewed_at integer not null,
  stability_after real,
  difficulty_after real
);
```

`front`/`back`/`graded_summary` are content — encrypted. `kind`,
`fsrs_*`, `graded_correct`, `flagged` are metadata *about* content, not
content itself — plaintext, and that's exactly what makes the due-cards
query (`where kind = 'question' and fsrs_due_at <= :now`) and the
analytics ratios (`group by graded_correct`) possible as plain SQL.

## Tags: normalized, referenced by opaque ID

The grading spec produces 3 tags per question; the analytics page wants
tag-frequency counts. If tag *names* were stored encrypted per-card
(e.g. as an encrypted JSON array column), frequency counting would
require decrypting every card's tags client-side and aggregating in JS —
workable, but throws away SQL's actual job. Instead:

```sql
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

The server aggregates by opaque `tag_id` (`select tag_id, count(*) from
card_tags group by tag_id order by count(*) desc`) without ever knowing
what a tag *means*; the client decrypts `name_ct` for the tags in that
result set to render "quadratic-equations: 14" instead of "tag #42: 14".
Same trick as the cards table: keep the thing SQL needs to group by
plaintext, keep the thing a human reads encrypted.

One real question this raises: **does the client dedupe tags by decrypted
name, or does the server?** The server can't — it never sees plaintext
names, so it has no way to know "photosynthesis" (this card) and
"Photosynthesis" (that card) are the same tag; it would create two rows.
Simplest answer: the client normalizes (lowercase, trim) before
encrypting a tag name and checks its own local cache of
already-decrypted tag names before minting a new one, but true
cross-device tag-name convergence without a server that can compare
plaintext is an open problem worth flagging, not solving here.

## Analytics: computed on read, no rollup table

Every metric `study-analytics-page` R1/R2 wants is a plain aggregate
query against tables that already exist — no separate pre-aggregated
"analytics" table:

- Focus/break time trend: `session_events`, bucketed by day client-side
  from `computeSessionStats`-style logic (already exists in
  `src/lib/store.ts` — this just runs it over a longer history than "the
  current session").
- Correct/incorrect ratio: `select graded_correct, count(*) from cards
  where kind = 'question' group by graded_correct`.
- Tag frequency: the `card_tags` group-by above.
- Review throughput: `select date(reviewed_at, 'unixepoch'), count(*)
  from card_reviews group by 1`.

Building a materialized rollup table now would be optimizing a query
pattern that doesn't have a performance problem yet — a personal note
app's SQLite file is small enough that these aggregates run in
milliseconds unindexed. Revisit only if that stops being true.

## Open questions this brainstorm surfaces (beyond each feature spec's own)

- Tag name convergence across devices (above) — needs a real answer
  before tags ship, not before this brainstorm.
- Whether `back_ct` (a question's answer) should be required at
  creation or genuinely nullable until grading fills it in — affects
  whether grading is "fill in the blank" or "verify what's already
  there."
- Whether vocab cards need their own extra columns eventually (e.g. part
  of speech, example sentence) that don't fit `front`/`back`, in which
  case a `kind`-specific JSON column (`extra_ct`) might be cleaner than
  widening the table further per new kind.
