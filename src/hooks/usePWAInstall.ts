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
  /** WhatsApp, Instagram, Facebook etc. built-in browsers: they cannot install apps */
  isInAppBrowser: boolean;
  /**
   * On Android, only Chrome installs a Google-signed app (WebAPK) that Play Protect trusts.
   * Samsung Internet, Opera, Edge and other browsers build their own app package targeting
   * an old Android version, which Play Protect blocks as "Unsafe app".
   */
  mustOpenInChrome: boolean;
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
      isInAppBrowser: false,
      mustOpenInChrome: false,
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

  const isInAppBrowser =
    /; wv\)/.test(uaLower) || /fban|fbav|instagram|line\/|whatsapp|snapchat|twitter|tiktok/.test(uaLower);
  const mustOpenInChrome = isAndroid && (browser !== "Chrome" || isInAppBrowser);

  return {
    browser,
    os,
    isIOS,
    isAndroid,
    isMobile,
    isDesktop,
    supportsNativePrompt,
    displayName,
    isInAppBrowser,
    mustOpenInChrome,
  };
}

/**
 * Android intent link that opens the current page in Google Chrome
 * (falls back to the normal page if Chrome is not installed).
 */
export function getOpenInChromeUrl(): string {
  if (typeof window === "undefined") return "/";
  const { host, pathname, search } = window.location;
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

export const DEFAULT_BROWSER_DETECTION: BrowserDetection = {
  browser: "Browser",
  os: "Unknown",
  isIOS: false,
  isAndroid: false,
  isMobile: false,
  isDesktop: true,
  supportsNativePrompt: false,
  displayName: "Browser",
  isInAppBrowser: false,
  mustOpenInChrome: false,
};

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<BrowserDetection>(DEFAULT_BROWSER_DETECTION);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

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
    isMounted,
  };
}
