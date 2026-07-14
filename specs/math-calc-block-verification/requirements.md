# Math/calc/help block verification

> design.md and tasks.md deferred — this pass is requirements only.

## Problem

`/math` and `/calc` currently just insert an inert template (see
`src/lib/commands.ts` — both are `ai: false`); nothing checks whether the
math is valid, formatted correctly, or numerically correct. `/help`
already calls AI, but as a one-shot fire on invocation rather than on a
natural "I'm done with this thought" boundary. The app already has a
closing marker for blocks (`/>` — "Close current item
(question/math/calc/vocab)") but today it's just template text; closing a
block doesn't trigger anything.

## Requirements

- R1. Typing a `/math` block and closing it with `/>` sends the raw math
  the user typed (e.g. `a^2 + b*b = c_1^2`) to a local model dedicated to
  this correction task, which rewrites it as valid MathJax/LaTeX in
  place. The user can write math shorthand; they don't need to already
  know MathJax syntax.
- R2. Typing a `/calc` block and closing it with `/>` sends the
  calculation to be checked, but correctness is established by actually
  **executing** the arithmetic (a tool/function call the model invokes),
  not by trusting the model's own mental math. The corrected/verified
  result replaces or annotates the block.
- R3. `/help` follows the same insert-then-close interaction pattern as
  `/math` and `/calc`, rather than firing immediately on typing `/help`
  — closing the block is the one consistent trigger point for all
  AI-assisted commands, not a special case per command.
- R4. The model used for R1/R2 correction can be configured separately
  from the main chat/coaching model used elsewhere (`/help`, `/end`) —
  a smaller/faster local model is a reasonable choice for a narrow
  correction task, and the user shouldn't be forced to use the same
  model for both. Defaults to the primary configured local AI model if
  no separate one is set.
- R5. All of this still respects the app's local-only AI policy — the
  correction/verification model is another locally configured endpoint,
  never a cloud call.
- R6. If the correction/verification call fails (model unreachable,
  malformed output), the block is left as the user wrote it with a
  visible error state — never silently discarded or replaced with
  something the user didn't write.

## Non-goals (this pass)

- Real-time/incremental correction while typing. Correction happens once,
  on close.
- A general-purpose sandboxed code execution environment. R2's "tool"
  is scoped to evaluating arithmetic/math expressions, not arbitrary code.
- Changing `/question` or `/vocab` block behavior — covered separately in
  `specs/question-grading-and-flagging/`.

## Open questions

- Exact UX for R4's second model setting (a new Settings field, most
  likely — mirrors the existing local-AI settings pattern).
- What "the tool" for R2 actually is: a safe expression evaluator
  (arithmetic + common functions) is enough for the given example; whether
  it needs to grow beyond that is a design-time decision, not answered
  here.
- Whether R1/R2 failures (R6) should retry automatically or require the
  user to re-close the block.
