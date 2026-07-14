# Specs

This directory holds specs for features developed spec-first. Each feature
gets its own folder:

```
specs/
  <feature-slug>/
    requirements.md
    design.md
    tasks.md
```

Copy `specs/_template/` to get started:

```
cp -r specs/_template specs/<feature-slug>
```

## Workflow

1. **requirements.md** first. Describe the feature from the user's
   perspective — what it does, what it doesn't do, edge cases that matter.
   No mention of files, functions, or libraries yet.
2. **design.md** next, once requirements are settled. Describe the technical
   approach: what changes in `src/lib/store.ts`, which new files/components
   are needed, how it hooks into the command system or router, and any
   trade-offs or alternatives you considered and rejected.
3. **tasks.md** last. Break the design into an ordered, checkable list of
   implementation steps. Check items off as you complete them — this file
   is the running status of the feature, not just a plan.

Only implement after requirements and design are written down. If a
requirement turns out to be wrong or incomplete once you're in the design or
implementation, update `requirements.md` rather than silently drifting from
it.

Skip this process for small fixes, refactors, or anything you can hold
entirely in your head — it exists to prevent scope drift and rework on
features big enough to need it, not as ceremony for every change.
