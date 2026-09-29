import { useEffect, useState, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type SupportedBrowser =
  | "Safari"
  | "Chrome"
  | "Edge"
  | "Samsung Internet"
  | "Firefox"
  | "Opera"
  | "Brave"
  | "Browser";

export type SupportedOS = "iOS" | "Android" | "macOS" | "Windows" | "Linux" | "Unknown";

export interface BrowserDetection {
  browser: SupportedBrowser;
  os: SupportedOS;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  supportsNativePrompt: boolean;
  displayName: string;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function detectBrowserAndOS(): BrowserDetection {
  if (typeof window === "undefined") {
    return {
      browser: "Browser",
      os: "Unknown",
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isDesktop: true,
      supportsNativePrompt: false,
      displayName: "Browser",
    };
  }

  const ua = window.navigator.userAgent;
  const uaLower = ua.toLowerCase();

  // 1. Detect OS
  let os: SupportedOS = "Unknown";
  const isIOS =
    /iphone|ipad|ipod/.test(uaLower) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(uaLower);
  const isMacOS = !isIOS && /macintosh|mac os x/.test(uaLower);
  const isWindows = /windows nt/.test(uaLower);
  const isLinux = !isAndroid && /linux/.test(uaLower);

  if (isIOS) os = "iOS";
  else if (isAndroid) os = "Android";
  else if (isMacOS) os = "macOS";
  else if (isWindows) os = "Windows";
  else if (isLinux) os = "Linux";

  const isMobile = isIOS || isAndroid || /mobile/.test(uaLower);
  const isDesktop = !isMobile;

  // 2. Detect Browser
  let browser: SupportedBrowser = "Browser";

  if (/samsungbrowser/.test(uaLower)) {
    browser = "Samsung Internet";
  } else if (/edg([ea])?/.test(uaLower)) {
    browser = "Edge";
  } else if (/opr\//.test(uaLower) || /opera/.test(uaLower)) {
    browser = "Opera";
  } else if (/firefox|fxios/.test(uaLower)) {
    browser = "Firefox";
  } else if (/crios|chrome/.test(uaLower)) {
    browser = "Chrome";
  } else if (/safari/.test(uaLower) && !/chrome|crios|android/.test(uaLower)) {
    browser = "Safari";
  }

  const supportsNativePrompt = !isIOS && (browser === "Chrome" || browser === "Edge" || browser === "Samsung Internet" || browser === "Opera");

  const displayName = `${browser} on ${os}`;

  return {
    browser,
    os,
    isIOS,
    isAndroid,
    isMobile,
    isDesktop,
    supportsNativePrompt,
    displayName,
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== "undefined" && window.__pwaInstallPrompt) {
      return window.__pwaInstallPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<BrowserDetection>(() => detectBrowserAndOS());

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    setBrowserInfo(detectBrowserAndOS());

    if (window.__pwaInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [deferredPrompt]);

  // Triggers the native browser install dialog if supported
  const triggerNativeInstall = useCallback(async (): Promise<{
    status: "prompted" | "accepted" | "dismissed" | "manual_guide_required";
  }> => {
    const promptEvent =
      deferredPrompt || (typeof window !== "undefined" ? window.__pwaInstallPrompt : null);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          if (typeof window !== "undefined") window.__pwaInstallPrompt = null;
          return { status: "accepted" };
        }
        return { status: "dismissed" };
      } catch (err) {
        console.error("Install prompt error:", err);
        return { status: "manual_guide_required" };
      }
    }

    return { status: "manual_guide_required" };
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(
      deferredPrompt || (typeof window !== "undefined" && window.__pwaInstallPrompt),
    ),
    isInstalled,
    isIOS: browserInfo.isIOS,
    browserInfo,
    triggerNativeInstall,
    deferredPrompt,
  };
}
