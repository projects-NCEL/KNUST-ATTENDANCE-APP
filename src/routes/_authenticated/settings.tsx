import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { firebaseAuth } from "@/integrations/firebase/config";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Info,
  BookOpen,
  FileText,
  User,
  BellRing,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PushNotificationManager } from "@/components/PushNotificationManager";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Account Settings — Qmark" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();

  return (
    <AppShell>
      <div className="max-w-2xl lg:max-w-none mx-auto space-y-6 w-full">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your faculty account, notification preferences, and system documentation.
          </p>
        </div>

        {/* Account Details */}
        <Card className="border border-border bg-card shadow-xs rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="size-4 text-primary" /> Faculty Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">Email Address</span>
              <span className="font-semibold text-foreground">{user?.email || "faculty@institution.edu"}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">Account Role</span>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                {roles[0] || "Faculty"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Authentication Method</span>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="size-3.5" />
                <span>Google Institutional Sign In</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Push Notification Preferences */}
        {user?.id && (
          <Card className="border border-border bg-card shadow-xs rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BellRing className="size-4 text-primary" /> Notifications
              </CardTitle>
              <CardDescription className="text-xs">
                Configure browser alerts and session notifications for your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <PushNotificationManager
                userContext={{
                  userId: user.id,
                  userRole: "lecturer",
                }}
                showCard={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Comprehensive Embedded User Manual (as explicitly requested) */}
        <Card className="border border-border bg-card shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span>Qmark Faculty User Manual</span>
              </CardTitle>
              <Link
                to={"/manual" as string}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Open Full Page Manual →
              </Link>
            </div>
            <CardDescription className="text-xs">
              Complete step-by-step operating guidelines for courses, scanner, students, and attendance reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
            {/* Guide Sections */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <div className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                    1
                  </div>
                  <span>Courses & Student Directory</span>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-7">
                  Add your taught courses under the <b>Courses</b> tab with course code, title, and credit units. Enroll students manually or import via CSV. Students can also self-register at the Student Portal (<code>/student</code>) using their index number.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <div className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                    2
                  </div>
                  <span>Taking Attendance with the Scanner</span>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-7">
                  Open the <b>Scanner</b> tab and click <b>Start Camera</b>. If no active session exists, a Quick Session is created automatically. Point the camera at student QR passes or input the index number manually. Verified students receive an immediate green check receipt.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <div className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                    3
                  </div>
                  <span>Reports, Records & Analytics</span>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-7">
                  View daily, course-wide, or complete attendance records in the <b>Reports</b> tab. Automatically tracks students below the 75% exam qualification cutoff. Export records to Excel, CSV, or formatted PDF anytime.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <div className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                    4
                  </div>
                  <span>Notices, Assignments & Push Alerts</span>
                </div>
                <p className="text-muted-foreground leading-relaxed pl-7">
                  Broadcast lecture updates, venue changes, or assignment deadlines to your class through the <b>Notices</b> tab. Students receive instant web push notifications on mobile and desktop devices.
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <a
                href="/app-manual.pdf"
                download="Qmark_Faculty_Manual.pdf"
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <FileText className="size-3.5" />
                <span>Download Printable PDF Manual</span>
              </a>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Link to={"/privacy" as string} className="hover:text-foreground hover:underline">
                  Privacy Policy
                </Link>
                <span>·</span>
                <Link to={"/terms" as string} className="hover:text-foreground hover:underline">
                  Terms of Service
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation & Institutional Policies */}
        <Card className="border border-border bg-card shadow-xs rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Info className="size-4 text-primary" /> Institutional Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <Link
                to={"/manual" as string}
                className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition flex items-center gap-2 text-foreground font-semibold"
              >
                <BookOpen className="size-4 text-primary" />
                <span>Full Manual</span>
              </Link>

              <Link
                to={"/privacy" as string}
                className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition flex items-center gap-2 text-foreground font-semibold"
              >
                <ShieldCheck className="size-4 text-primary" />
                <span>Privacy Policy</span>
              </Link>

              <Link
                to={"/terms" as string}
                className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition flex items-center gap-2 text-foreground font-semibold"
              >
                <FileText className="size-4 text-primary" />
                <span>Terms of Service</span>
              </Link>
            </div>

            <div className="pt-3 text-[11px] text-muted-foreground text-center">
              Qmark Attendance Engine • Institutional Roll-Call Platform
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
