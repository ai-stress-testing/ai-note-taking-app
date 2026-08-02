# AI server-side proxy (Docker internal passthrough)

## Problem

The AI pipeline runs entirely in the browser: `runAi` does a client-side
`fetch` straight to the configured local server URL. That breaks in two common
setups:

- **Dockerized app.** When NeuroVim is served from a container, the browser
  still connects to the AI server directly — but the operator often wants the
  request to travel over the Docker network (a sibling `ollama` service, or the
  host via `host.docker.internal`). A browser can't resolve `host.docker.internal`
  or a compose service name, so those endpoints are unreachable from the page.
- **Hosted / non-localhost instance.** The browser must reach the AI URL
  directly, which requires the AI server to send permissive CORS headers for the
  app origin (the current Settings info box tells users to set `OLLAMA_ORIGINS`).
  Many servers can't or won't.

Both are solved by letting a request optionally travel **through the app's own
server** (same origin, no CORS) which — running inside the container — reaches
the AI over the Docker network. The user is talking to _the same AI_, just via a
different transport.

## Requirements

- Each configured AI model can be reached one of two ways, chosen in Settings:
  - **Direct** (default, current behavior): the browser fetches the model URL.
  - **Server passthrough**: the browser calls the app server, which forwards the
    request to the model URL and streams the response back.
- The toggle is per-model, in the AI-models Settings view, next to the URL.
- The **test connection** button honors the toggle, so the user can confirm the
  chosen transport actually reaches the server before saving.
- Passthrough must reach servers a browser can't: `host.docker.internal`, Docker
  service names, and private-LAN addresses.
- No new required configuration: passthrough works out of the box in the shipped
  Docker image; the operator doesn't have to set an env var.

## Non-goals

- No cloud AI. Passthrough only forwards to local/private targets — it is not a
  general web proxy (see the SSRF guard in Edge cases).
- No change to the privacy boundary. The personal-file gate in `ai-queue.ts`
  still runs client-side before any request is built, proxy or not.
- No streaming token UI. Chat calls remain `stream: false`; the proxy buffers.

## Edge cases

- **SSRF.** The proxy target comes from the client, so the server must refuse to
  forward to arbitrary hosts. Only loopback, `*.docker.internal`, dot-less
  hostnames (compose service names), and private IPv4 ranges are allowed; a
  public host is rejected with 403.
- **Auth.** AI works without sync configured, so the proxy route is not behind
  the sync bearer token. It is guarded by the target allowlist instead.
- **Stale transport.** Flipping a model direct↔proxy changes reachability; the
  resolved-base cache is keyed per transport so a cached direct base isn't
  reused for a proxy call.
- **Upstream errors.** A 404/500 from the AI server is passed through with its
  body intact so the existing error-detail surfacing still works.
