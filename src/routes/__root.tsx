import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerPushServiceWorker } from "@/lib/push-client";
import { GoldMeshBackground } from "@/components/GoldMeshBackground";
import { GlobalProgressBar } from "@/components/GlobalProgressBar";
import { SplashScreen } from "@/components/SplashScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const errorMessage = error?.message || "An unexpected error occurred.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage.includes("redirect") || errorMessage.includes("authStateReady")
            ? "Your session expired or needs authentication. Please sign in to continue."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-3 p-3 bg-muted/60 rounded-xl text-left text-xs font-mono text-muted-foreground break-all max-h-36 overflow-y-auto border border-border/60">
            {errorMessage}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 cursor-pointer"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold text-foreground transition-all hover:bg-accent cursor-pointer"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#ffffff" },
      { title: "Qmark — Next-Gen Attendance & Roll-Call Platform" },
      {
        name: "description",
        content:
          "Qmark is a high-speed QR attendance verification platform for institutions, lecturers, and students. Instant check-in, Apple Wallet-style digital passes, and automated grade compliance.",
      },
      { property: "og:title", content: "Qmark — Next-Gen Attendance & Roll-Call Platform" },
      {
        property: "og:description",
        content:
          "Instant QR attendance verification, digital pass cards, and real-time roll-call for students and lecturers.",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Qmark" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.jpg" },
      { property: "og:image:secure_url", content: "/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Qmark — Attendance, verified instantly." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Qmark — Attendance, verified instantly." },
      {
        name: "twitter:description",
        content:
          "Instant QR attendance verification, digital pass cards, and real-time roll-call for students and lecturers.",
      },
      { name: "twitter:image", content: "/og-image.jpg" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  });

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('qmark-theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}

              // Capture native PWA install prompt globally as early as possible
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
              });
            `,
          }}
        />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-[#D4AF37]/30 min-h-screen w-full max-w-[100vw] overflow-x-clip relative">
        <GoldMeshBackground />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Register PWA Web Push service worker in browser
    if (typeof window !== "undefined") {
      registerPushServiceWorker().catch(() => {});

      // Enforce anti-copy on non-input elements
      const isInputTarget = (target: EventTarget | null) => {
        if (!target || !(target instanceof HTMLElement)) return false;
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return true;
        if (target.isContentEditable) return true;
        if (target.closest("input, textarea, [contenteditable='true']")) return true;
        return false;
      };

      const handleCopyCut = (e: ClipboardEvent) => {
        if (!isInputTarget(e.target)) {
          e.preventDefault();
        }
      };

      const handleDragStart = (e: DragEvent) => {
        if (!isInputTarget(e.target)) {
          e.preventDefault();
        }
      };

      document.addEventListener("copy", handleCopyCut);
      document.addEventListener("cut", handleCopyCut);
      document.addEventListener("dragstart", handleDragStart);

      return () => {
        document.removeEventListener("copy", handleCopyCut);
        document.removeEventListener("cut", handleCopyCut);
        document.removeEventListener("dragstart", handleDragStart);
      };
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalProgressBar />
      <SplashScreen />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
