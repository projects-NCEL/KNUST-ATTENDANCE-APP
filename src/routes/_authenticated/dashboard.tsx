import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ScanLine,
  CalendarClock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { firestoreDb, firebaseAuth } from "@/integrations/firebase/config";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Qmark" },
      {
        name: "description",
        content: "Faculty portal for Qmark: Courses, sessions, scanner, reports, and student directory.",
      },
    ],
  }),
  component: Dashboard,
});

interface RecentScanItem {
  id: string;
  student_name: string;
  index_number: string;
  check_in_at: string;
}

function Dashboard() {
  const { user, roles } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [todayCount, setTodayCount] = useState<number>(0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    if (!currentUid) return;

    // Today's attendance scans
    const unsubScans = onSnapshot(
      query(
        collection(firestoreDb, "attendance_records"),
        where("owner_id", "==", currentUid),
        where("session_date", "==", todayStr),
      ),
      async (snap) => {
        setTodayCount(snap.size);

        // Fetch student details for the top recent 8
        const sortedDocs = snap.docs
          .sort((a, b) => ((b.data() as any).created_at || "").localeCompare((a.data() as any).created_at || ""))
          .slice(0, 8);

        const studentIds = Array.from(new Set(sortedDocs.map((d) => (d.data() as any).student_id).filter(Boolean)));
        const studentMap = new Map<string, { name: string; index: string }>();

        if (studentIds.length > 0) {
          const sSnap = await getDocs(
            query(collection(firestoreDb, "students"), where("owner_id", "==", currentUid)),
          );
          sSnap.docs.forEach((d) => {
            const data = d.data() as any;
            studentMap.set(d.id, { name: data.full_name || "Student", index: data.index_number || "" });
          });
        }

        const items: RecentScanItem[] = sortedDocs.map((d) => {
          const data = d.data() as any;
          const st = studentMap.get(data.student_id);
          return {
            id: d.id,
            student_name: st?.name || "Student",
            index_number: st?.index || "",
            check_in_at: data.check_in_at || data.created_at || new Date().toISOString(),
          };
        });

        setRecentScans(items);
      },
    );

    return () => {
      unsubScans();
    };
  }, [currentUid, todayStr]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ================================================================= */}
        {/* REDESIGNED & ANIMATED SLICK WHITE GLASS WELCOME CONTAINER         */}
        {/* ================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[26px] sm:rounded-[30px] p-6 sm:p-8 bg-white/75 dark:bg-white/10 backdrop-blur-3xl border border-white/60 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
        >
          {/* Subtle interior light sheen */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white dark:via-white/40 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/90 dark:bg-white/15 text-foreground border border-white/60 dark:border-white/20 shadow-2xs backdrop-blur-md">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Verified Faculty
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {formattedDate}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                Welcome, {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Lecturer"}
              </h1>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                Ready for today's lecture sessions. Use live camera scanning or generate new roll call codes.
              </p>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {/* Today's Scans Pill */}
              <div className="flex items-center justify-between sm:justify-start gap-3 px-4 py-2.5 rounded-2xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/15 backdrop-blur-md shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-muted-foreground">Today's Scans</span>
                </div>
                <span className="text-lg font-black text-foreground font-mono">{todayCount}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Link to={"/scan" as string} className="flex-1 sm:flex-initial">
                  <Button className="w-full sm:w-auto h-11 px-6 rounded-2xl text-xs font-bold gap-2 cursor-pointer shadow-md bg-foreground text-background hover:opacity-90 transition-all">
                    <ScanLine className="size-4" />
                    <span>Scan</span>
                  </Button>
                </Link>
                <Link to={"/sessions" as string} className="flex-1 sm:flex-initial">
                  <Button variant="outline" className="w-full sm:w-auto h-11 px-5 rounded-2xl text-xs font-bold gap-1.5 cursor-pointer bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/20 hover:bg-white dark:hover:bg-white/20 transition-all backdrop-blur-md">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    <span>New Session</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Today's Activity Stream */}
        <Card className="border border-white/60 dark:border-white/15 bg-white/70 dark:bg-card/40 backdrop-blur-2xl shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between px-5 pt-5 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Today's Scans</span>
            </CardTitle>
            <Link to="/reports" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              <span>Reports</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentScans.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No attendance scans recorded today yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentScans.map((item) => (
                  <div key={item.id} className="p-3.5 px-5 flex items-center justify-between gap-3 text-xs hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{item.student_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.index_number}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        PRESENT
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(item.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
