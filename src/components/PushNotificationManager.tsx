import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Send,
  Loader2,
  Settings2,
  ExternalLink,
  Shield,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getPushPermissionStatus,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  getExistingPushSubscription,
  isIOS,
  isStandalone,
  PushPermissionStatus,
  PushUserContext,
} from "@/lib/push-client";

interface PushNotificationManagerProps {
  userContext: PushUserContext;
  showCard?: boolean;
  onSubscribedChange?: (isSubscribed: boolean) => void;
}

export function PushNotificationManager({
  userContext,
  showCard = true,
  onSubscribedChange,
}: PushNotificationManagerProps) {
  const [status, setStatus] = useState<PushPermissionStatus>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preferences, setPreferences] = useState({
    pushEnabled: true,
    attendance: true,
    announcements: true,
    assignments: true,
    deadlines: true,
    system: true,
  });

  // Check current device and subscription status
  const checkStatus = useCallback(async () => {
    const currentStatus = getPushPermissionStatus();
    setStatus(currentStatus);

    if (currentStatus === "granted") {
      const sub = await getExistingPushSubscription();
      const active = Boolean(sub);
      setIsSubscribed(active);
      onSubscribedChange?.(active);
    } else {
      setIsSubscribed(false);
      onSubscribedChange?.(false);
    }
  }, [onSubscribedChange]);

  // Load preferences from server
  const loadPreferences = useCallback(async () => {
    if (!userContext.userId) return;
    try {
      const res = await fetch(`/api/push/preferences?userId=${encodeURIComponent(userContext.userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [userContext.userId]);

  useEffect(() => {
    checkStatus();
    loadPreferences();
  }, [checkStatus, loadPreferences]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const result = await subscribeDeviceToPush(userContext);
      setStatus(result.status);
      if (result.success) {
        setIsSubscribed(true);
        onSubscribedChange?.(true);
        toast.success(result.message || "Push notifications enabled!");
      } else {
        if (result.status === "ios_pwa_required") {
          toast.error("Add QRoll to Home Screen first on iPhone/iPad to enable push notifications.");
        } else {
          toast.error(result.message || "Failed to enable notifications");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to subscribe device");
    } finally {
      setLoading(false);
      checkStatus();
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const ok = await unsubscribeDeviceFromPush(userContext);
      if (ok) {
        setIsSubscribed(false);
        onSubscribedChange?.(false);
        toast.info("Notifications disabled for this device.");
      }
    } catch {
      toast.error("Failed to disable notifications");
    } finally {
      setLoading(false);
      checkStatus();
    }
  };

  const handleTogglePreference = async (key: keyof typeof preferences, val: boolean) => {
    const updated = { ...preferences, [key]: val };
    setPreferences(updated);
    try {
      await fetch("/api/push/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userContext.userId,
          preferences: updated,
        }),
      });
      toast.success("Notification preferences updated");
    } catch {
      toast.error("Failed to save preference");
    }
  };

  const handleSendTest = async () => {
    if (!isSubscribed) {
      toast.error("Please enable push notifications on this device first.");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userContext.userId,
          payload: {
            type: "TEST",
            title: "KNUST QRoll Push Verified",
            body: "Real OS/browser push notifications are active and functioning correctly on this device!",
            url: "/student",
            icon: "/favicon.png",
            badge: "/favicon.png",
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.delivered > 0) {
        toast.success("Test notification dispatched! Check your device lockscreen / notifications banner.");
      } else {
        toast.warning(data.error || "Notification dispatched. Ensure browser allows background notifications.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch test notification");
    } finally {
      setTesting(false);
    }
  };

  // State Card: iOS Safari Home Screen requirement guidance
  if (status === "ios_pwa_required") {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900 dark:text-amber-200">
              iPhone / iPad Push Notifications Setup
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-amber-800 dark:text-amber-300">
            Apple requires web apps to be installed to the Home Screen to receive push notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <ol className="list-decimal pl-4 space-y-1.5 font-medium">
            <li>In Safari, tap the <strong>Share</strong> button at the bottom of the screen.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Launch the new <strong>KNUST Attendance</strong> app icon from your Home Screen.</li>
            <li>Return to this page inside the installed app and tap <strong>Enable Notifications</strong>.</li>
          </ol>
          <div className="pt-2">
            <Badge variant="outline" className="text-amber-800 border-amber-300">
              iOS 16.4+ Web Push Standard
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State Card: Unsupported Browser
  if (status === "unsupported") {
    return (
      <Card className="border-slate-200 bg-slate-50 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-slate-500" />
            <CardTitle className="text-base">Push Notifications Not Supported</CardTitle>
          </div>
          <CardDescription className="text-xs">
            This browser does not support the Web Push API. For the best experience, use modern Chrome, Edge, Firefox, or Safari on iOS 16.4+.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!showCard) {
    return null;
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isSubscribed ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
              {isSubscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
            </div>
            <div>
              <CardTitle className="text-base font-bold">Web Push Notifications</CardTitle>
              <CardDescription className="text-xs">
                Receive real-time alerts on your device lock-screen and notification center.
              </CardDescription>
            </div>
          </div>
          <div>
            {status === "denied" ? (
              <Badge variant="destructive" className="text-xs">
                Blocked in Browser
              </Badge>
            ) : isSubscribed ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                <CheckCircle2 className="size-3 mr-1" /> Active on this Device
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Not Enabled
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permission Action CTA */}
        <div className="p-4 rounded-xl border bg-muted/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {isSubscribed ? "Device is registered for Push" : "Enable Push for this Device"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === "denied"
                ? "Notifications are currently blocked. Click the lock/info icon in your browser URL bar to allow notifications."
                : isSubscribed
                ? "You will receive attendance, announcements, and assignment alerts even when QRoll is closed."
                : "Grant notification permission so your browser can receive background academic alerts."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSubscribed ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={testing}
                  className="text-xs flex items-center gap-1.5"
                >
                  {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Send Test Alert
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Disable
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSubscribe}
                disabled={loading || status === "denied"}
                size="sm"
                className="bg-knust-green hover:bg-knust-green/90 text-white text-xs font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell className="size-3.5 mr-1.5" />
                    Enable Notifications
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Notification Category Preferences */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Settings2 className="size-3.5" />
            Alert Preferences
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Attendance Sessions</span>
                <p className="text-xs text-muted-foreground">When attendance opens or closes</p>
              </div>
              <Switch
                checked={preferences.attendance}
                onCheckedChange={(v) => handleTogglePreference("attendance", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Course Announcements</span>
                <p className="text-xs text-muted-foreground">Lecturer messages and updates</p>
              </div>
              <Switch
                checked={preferences.announcements}
                onCheckedChange={(v) => handleTogglePreference("announcements", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">New Assignments</span>
                <p className="text-xs text-muted-foreground">When coursework is posted</p>
              </div>
              <Switch
                checked={preferences.assignments}
                onCheckedChange={(v) => handleTogglePreference("assignments", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Deadlines & Reminders</span>
                <p className="text-xs text-muted-foreground">Upcoming due dates and expirations</p>
              </div>
              <Switch
                checked={preferences.deadlines}
                onCheckedChange={(v) => handleTogglePreference("deadlines", v)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** In-App Notification Center Drawer / Dropdown */
export function InAppNotificationCenter({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/push/notifications?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch("/api/push/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative text-foreground hover:bg-muted"
        title="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-600"></span>
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden">
          <div className="p-3.5 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                Loading alerts...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <CheckCircle2 className="size-7 text-muted-foreground/50 mx-auto" />
                <p className="font-medium">All caught up!</p>
                <p>No new alerts at this time.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.url || "#"}
                  onClick={() => setOpen(false)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-muted/50 transition-colors block ${
                    !n.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="mt-0.5 size-2 rounded-full shrink-0 bg-primary" style={{ opacity: n.isRead ? 0 : 1 }} />
                  <div className="flex-1 space-y-0.5">
                    <p className="text-xs font-semibold leading-tight text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{n.body}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                      <Clock className="size-3" />
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
