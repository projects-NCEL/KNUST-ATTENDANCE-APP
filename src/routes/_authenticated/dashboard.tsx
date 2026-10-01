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
  Plus,
  ArrowRight,
} from "lucide-react";
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
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground mb-2">
              <ShieldCheck className="size-3 text-primary" />
              <span>Dashboard</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Welcome, {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Lecturer"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formattedDate} · <span className="font-semibold text-foreground">{roles[0] || "Faculty"}</span>
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-xl border border-border/80 bg-muted/40 text-xs">
              <span className="text-muted-foreground">Today's Scans: </span>
              <span className="font-bold text-foreground text-sm ml-1">{todayCount}</span>
            </div>
          </div>
        </div>

        {/* Quick Launch Card with simple short button names */}
        <div className="p-5 sm:p-6 rounded-2xl border border-[#B8861B]/30 bg-card/70 backdrop-blur-md shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Attendance Verification
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Verify student QR passes or create a lecture session.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link to={"/scan" as string}>
              <Button className="h-10 px-5 rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-sm">
                <ScanLine className="size-4" />
                <span>Scan</span>
              </Button>
            </Link>
            <Link to={"/sessions" as string}>
              <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5 cursor-pointer">
                <CalendarClock className="size-4 text-muted-foreground" />
                <span>New Session</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Today's Activity Stream (Active Classroom Sessions removed as requested) */}
        <Card className="border border-border/60 bg-card/70 backdrop-blur-md shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Today's Scans</span>
            </CardTitle>
            <Link to="/reports" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              <span>Records</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentScans.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No attendance scans recorded today yet.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentScans.map((item) => (
                  <div key={item.id} className="p-3.5 px-5 flex items-center justify-between gap-3 text-xs">
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
