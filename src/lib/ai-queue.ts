import { runAi, type AiResult } from "./ai-client";
import { isFilePersonal, useStore } from "./store";

/**
 * Serializes every AI call behind a single promise chain so at most one
 * request is ever in flight against the local server, and enforces the AI
 * privacy boundary: this is the ONLY module app code may call for AI, so a
 * personal file is checked exactly once, here, for every current and
 * future feature. Each call is recorded in the store's aiQueue as it's
 * queued, sent, and resolved — the same list is the pending queue and the
 * audit trail shown in the AI queue modal.
 */
let tail: Promise<void> = Promise.resolve();

export class PersonalContentError extends Error {
  constructor() {
    super("not sent — this file is personal");
    this.name = "PersonalContentError";
  }
}

export function queueAi(opts: {
  command: string;
  system: string;
  prompt: string;
  localAiEnabled: boolean;
  localAiUrl: string;
  localAiModel: string;
  /** The file whose content the prompt was built from; gates the privacy check. */
  fileId?: string | null;
}): Promise<AiResult> {
  const state = useStore.getState();
  if (opts.fileId && isFilePersonal(opts.fileId, state.files, state.folders)) {
    return Promise.reject(new PersonalContentError());
  }

  const { enqueueAiEntry, updateAiEntry } = state;
  const id = enqueueAiEntry(opts.command, opts.system, opts.prompt);

  const run = async (): Promise<AiResult> => {
    updateAiEntry(id, { status: "sending" });
    try {
      const result = await runAi({
        system: opts.system,
        prompt: opts.prompt,
        localAiEnabled: opts.localAiEnabled,
        localAiUrl: opts.localAiUrl,
        localAiModel: opts.localAiModel,
      });
      updateAiEntry(id, { status: "ok", result: result.text, respondedAt: Date.now() });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateAiEntry(id, { status: "error", error: message, respondedAt: Date.now() });
      throw err;
    }
  };

  // Chain onto the tail regardless of whether the prior call succeeded or
  // failed, so one bad request never blocks the rest of the queue.
  const result = tail.then(run, run);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
