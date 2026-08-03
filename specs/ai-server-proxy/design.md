# AI server-side proxy — design

## Approach

A single new server route, `/api/ai-proxy`, forwards an OpenAI-compatible
request to a target base URL from inside the app server (i.e. inside the
container on the Docker network). The client opts a model into it with a new
`proxy` flag; when set, `ai-client.ts` rewrites its `fetch` URLs from
`<base>/models` / `<base>/chat/completions` to
`/api/ai-proxy?url=<encoded absolute target>` on the app's own origin.

Because the request now originates server-side, CORS disappears (same origin
app→proxy; server→AI is not a browser context) and the server can resolve
`host.docker.internal` / compose service names that the browser cannot.

### Server (`src/lib/server/api.ts`)

`handleApi` gains an early branch: if `pathname === "/api/ai-proxy"`, handle it
**before** the sync auth/rate-limit block (AI is independent of sync). The
handler:

1. Reads `url` from the query string, parses it, requires `http:`/`https:`.
2. Runs `isAllowedProxyTarget(hostname)` — the SSRF guard. Rejects with 403 if
   the host isn't loopback / `*.docker.internal` / dot-less / private IPv4.
3. Forwards `request.method`, the JSON body (for POST), and `content-type` to
   the target with a timeout, then returns the upstream status + body +
   content-type verbatim.

The guard is a small pure helper (`isAllowedProxyTarget`) so it is unit-checkable
and lives next to the route.

### Client (`src/lib/ai-client.ts`)

A `proxy: boolean` threads through `probeLocalAi`, `runAi`, `resolveBase`,
`probeBases`, and the two fetch helpers. A one-liner
`endpointUrl(target, proxy)` returns either `target` (direct) or
`/api/ai-proxy?url=<encoded target>` (proxy). The resolved-base cache key is
prefixed with the transport so direct and proxy resolutions don't collide.

### Plumbing

- `queueAi` (`ai-queue.ts`) gains `localAiProxy?: boolean`, passed to `runAi`.
- The three `queueAi` call sites in `routes/index.tsx` pass
  `localAiProxy: activeModel.proxy`.
- Settings (`SettingsModal.tsx`): the draft form gets a checkbox; `probeLocalAi`
  is called with `draft.proxy`; the config list shows a "via server" badge.

## Data model changes

- `AiModelConfig` gains optional `proxy?: boolean` (`src/lib/store.ts`). It's
  additive and defaults to falsy, so existing persisted configs need **no
  migration and no store `version` bump** — an absent field reads as direct.
- The registry is already device-local and excluded from encrypted sync
  (`partialize` includes `aiModels`, `sync-schema.ts` unchanged), so the new
  field is never synced.

## Alternatives considered

- **Env-configured fixed proxy target** (`NEUROVIM_AI_PROXY_TARGET`). Simplest
  SSRF story (no client-supplied target) but forces operator config and can't
  express "the same AI, two transports" per model. Rejected for the UX; the
  allowlist gives the same safety without configuration.
- **Rewrite the URL to `host.docker.internal` client-side.** Doesn't work — the
  browser can't resolve it. This is the whole reason a server hop is needed.
- **Streaming passthrough.** Unnecessary; chat calls are non-streaming.

## Open questions

None blocking. A future escape hatch for a non-private LAN AI host could add an
env allowlist, but the private-range rule already covers typical LAN setups.
