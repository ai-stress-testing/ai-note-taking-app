import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div style={{ padding: "2rem", fontFamily: "var(--font-mono)" }}>
      <h2>404</h2>
      <p>
        Not found.{" "}
        <a href="/" style={{ color: "var(--ctp-mauve)" }}>
          Return
        </a>
      </p>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div style={{ padding: "2rem", fontFamily: "var(--font-mono)" }}>
      <h2>error</h2>
      <pre style={{ color: "var(--ctp-red)" }}>{error.message}</pre>
      <button
        className="ed-btn"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        style={{
          padding: "0.4rem 0.8rem",
          background: "var(--ctp-mauve)",
          color: "var(--ctp-crust)",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        retry
      </button>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NeuroVim — Editor" },
      { name: "description", content: "Editor with folders, files, and slash commands." },
      { property: "og:title", content: "NeuroVim — Editor" },
      { property: "og:description", content: "Editor with folders, files, and slash commands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NeuroVim — Editor" },
      { name: "twitter:description", content: "Editor with folders, files, and slash commands." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
