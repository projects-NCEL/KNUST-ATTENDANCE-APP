import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { firebaseAuth, firestoreDb } from "@/integrations/firebase/config";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  ArrowRight,
  RotateCcw,
  Search,
  Sparkles,
  Check,
  X,
  Users,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/promotion")({
  head: () => ({ meta: [{ title: "Student Promotion — KNUST ATTENDANCE APP" }] }),
  component: PromotionPage,
});

const DEFAULT_LEVELS = ["100", "200", "300", "400"] as const;

function PromotionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  // Mode: "cascade" (all classes step up) or "single" (one class)
  const [mode, setMode] = useState<"cascade" | "single">("cascade");
  const [sourceLevel, setSourceLevel] = useState<string>("100");
  const [targetLevel, setTargetLevel] = useState<string>("200");

  // IDs of students marked to repeat
  const [repeatIds, setRepeatIds] = useState<Set<string>>(new Set());

  // Search & filters
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showOnlyRepeaters, setShowOnlyRepeaters] = useState(false);

  const [executing, setExecuting] = useState(false);

  // Fetch class levels
  const { data: classLevels } = useQuery({
    queryKey: ["class-levels", currentUid],
    queryFn: async () => {
      if (!currentUid) return [];
      const snap = await getDocs(
        query(collection(firestoreDb, "class_levels"), where("owner_id", "==", currentUid)),
      );
      return snap.docs.map((d) => (d.data() as any).name as string);
    },
    enabled: !!currentUid,
  });

  const levels = useMemo(() => {
    const list = classLevels && classLevels.length > 0 ? classLevels : Array.from(DEFAULT_LEVELS);
    return Array.from(new Set(list)).sort((a, b) => {
      const an = parseInt(a, 10),
        bn = parseInt(b, 10);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.localeCompare(b);
    });
  }, [classLevels]);

  const firstLevel = levels[0] || "100";

  // Fetch all students
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students", currentUid],
    queryFn: async () => {
      if (!currentUid) return [];
      const snap = await getDocs(
        query(collection(firestoreDb, "students"), where("owner_id", "==", currentUid)),
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return list.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    },
    enabled: !!currentUid,
  });

  // Destination level in cascade mode
  const getNextLevelCascade = (currentLvl: string): string => {
    const idx = levels.indexOf(currentLvl);
    if (idx === -1) return currentLvl;
    if (idx === levels.length - 1) return "Graduated";
    return levels[idx + 1];
  };

  const getTargetForStudent = (student: any): string => {
    const lvl = String(student.level || "").trim();
    if (mode === "single") {
      return lvl === sourceLevel ? targetLevel : lvl;
    }
    return getNextLevelCascade(lvl);
  };

  // Eligible students
  const eligibleStudents = useMemo(() => {
    return (students ?? []).filter((s) => {
      if (mode === "single") return String(s.level) === sourceLevel;
      return levels.includes(String(s.level));
    });
  }, [students, mode, sourceLevel, levels]);

  // Filtered students for touch list
  const filteredStudents = useMemo(() => {
    let list = eligibleStudents;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.index_number?.toLowerCase().includes(q) ||
          s.program?.toLowerCase().includes(q),
      );
    }
    if (mode === "cascade" && levelFilter !== "all") {
      list = list.filter((s) => String(s.level) === levelFilter);
    }
    if (showOnlyRepeaters) {
      list = list.filter((s) => repeatIds.has(s.id));
    }
    return list;
  }, [eligibleStudents, search, levelFilter, showOnlyRepeaters, repeatIds, mode]);

  // Toggle repeating status
  const toggleRepeat = (id: string) => {
    setRepeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const repeatCount = eligibleStudents.filter((s) => repeatIds.has(s.id)).length;
  const promoteCount = eligibleStudents.length - repeatCount;

  // Execute promotion
  const handlePromote = async () => {
    if (promoteCount === 0) {
      toast.error("No students are scheduled to be promoted");
      return;
    }

    setExecuting(true);
    const toastId = toast.loading("Promoting students in bulk...");

    try {
      const studentsToPromote = eligibleStudents.filter((s) => !repeatIds.has(s.id));

      const plan = studentsToPromote.map((s) => ({
        student: s,
        nextLevel: getTargetForStudent(s),
      }));

      // Sort descending by level (e.g. 400 first, then 300, 200, 100)
      plan.sort((a, b) => {
        const idxA = levels.indexOf(String(a.student.level));
        const idxB = levels.indexOf(String(b.student.level));
        return idxB - idxA;
      });

      // Ensure "Graduated" class level exists in DB if needed
      if (currentUid && mode === "cascade") {
        try {
          const snap = await getDocs(
            query(
              collection(firestoreDb, "class_levels"),
              where("owner_id", "==", currentUid),
              where("name", "==", "Graduated"),
            ),
          );
          if (snap.empty) {
            await addDoc(collection(firestoreDb, "class_levels"), {
              name: "Graduated",
              owner_id: currentUid,
            });
          }
        } catch {
          // ignore
        }
      }

      // Batch update in chunks of 200
      for (let i = 0; i < plan.length; i += 200) {
        const chunk = plan.slice(i, i + 200);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(({ student, nextLevel }) => {
          const ref = doc(firestoreDb, "students", student.id);
          batch.update(ref, { level: nextLevel });
        });
        await batch.commit();
      }

      toast.success(
        `✓ Promotion complete: ${plan.length} students promoted. ${repeatCount} repeating.`,
        { id: toastId },
      );

      if (mode === "cascade") {
        const rem = eligibleStudents.filter(
          (s) => String(s.level) === firstLevel && repeatIds.has(s.id),
        ).length;
        toast.info(
          `Level ${firstLevel} now has ${rem} repeater(s) and is ready for fresh student imports!`,
        );
      }

      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["class-levels"] });
      setRepeatIds(new Set());
      setSearch("");
      navigate({ to: "/students" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute promotions", { id: toastId });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-3 pb-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to={"/students" as string}
            className="text-xs sm:text-sm text-muted-foreground inline-flex items-center hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            Back to Students Directory
          </Link>
          <span className="text-xs text-muted-foreground font-medium">
            Academic Year Transition
          </span>
        </div>

        {/* Main Card */}
        <Card className="border shadow-sm">
          <CardHeader className="p-3.5 sm:p-5 pb-2 sm:pb-3 border-b">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <GraduationCap className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg font-bold">
                  Class Promotion & Roll-Over
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Move classes up one level in bulk. Select individual students who are repeating.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3.5 sm:p-5 space-y-3">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/70 rounded-lg text-xs">
              <button
                type="button"
                className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 text-xs ${
                  mode === "cascade"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("cascade")}
              >
                <Sparkles className="size-3.5 text-primary" />
                All Classes (Roll-Over)
              </button>
              <button
                type="button"
                className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 text-xs ${
                  mode === "single"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("single")}
              >
                <ArrowRight className="size-3.5" />
                Single Class
              </button>
            </div>

            {/* Pathway Summary */}
            {mode === "cascade" ? (
              <div className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span className="font-semibold text-foreground">Progression Pathway</span>
                  <span className="text-primary font-semibold">
                    Level {firstLevel} clears for new admissions
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {levels.map((lvl, i) => (
                    <span key={lvl} className="flex items-center gap-1 shrink-0 font-medium text-xs">
                      <span className="px-2 py-0.5 rounded bg-background border text-foreground">
                        L{lvl}
                      </span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      {i === levels.length - 1 && (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                          Graduated
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-2.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1 font-medium">
                    From Class
                  </span>
                  <Select value={sourceLevel} onValueChange={setSourceLevel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((l) => (
                        <SelectItem key={l} value={l}>
                          Level {l} ({(students ?? []).filter((s) => String(s.level) === l).length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1 font-medium">
                    To Class
                  </span>
                  <Select value={targetLevel} onValueChange={setTargetLevel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((l) => (
                        <SelectItem key={l} value={l}>
                          Level {l}
                        </SelectItem>
                      ))}
                      <SelectItem value="Graduated">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Search & Repeaters Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students to mark as repeating..."
                  className="h-8 pl-8 pr-8 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-1 flex-wrap text-xs">
                {mode === "cascade" ? (
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                    <button
                      type="button"
                      className={`px-2 py-1 rounded text-xs font-medium shrink-0 transition-colors ${
                        levelFilter === "all"
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      onClick={() => setLevelFilter("all")}
                    >
                      All ({eligibleStudents.length})
                    </button>
                    {levels.map((l) => {
                      const count = eligibleStudents.filter((s) => String(s.level) === l).length;
                      return (
                        <button
                          key={l}
                          type="button"
                          className={`px-2 py-1 rounded text-xs font-medium shrink-0 transition-colors ${
                            levelFilter === l
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => setLevelFilter(l)}
                        >
                          L{l} ({count})
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {eligibleStudents.length} student{eligibleStudents.length === 1 ? "" : "s"} in Level {sourceLevel}
                  </div>
                )}

                <button
                  type="button"
                  className={`px-2 py-1 rounded text-xs font-medium shrink-0 ml-auto transition-colors flex items-center gap-1 ${
                    showOnlyRepeaters
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setShowOnlyRepeaters(!showOnlyRepeaters)}
                >
                  <RotateCcw className="size-3" />
                  Repeaters ({repeatCount})
                </button>
              </div>
            </div>

            {/* Student List */}
            {authLoading || (loadingStudents && !students) ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading students...</p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y rounded-lg border min-h-[220px] max-h-[380px] bg-card">
                {filteredStudents.map((s) => {
                  const isRepeating = repeatIds.has(s.id);
                  const target = getTargetForStudent(s);
                  const targetLabel = target === "Graduated" ? "Grad" : `L${target}`;

                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleRepeat(s.id)}
                      className={`px-3 py-2.5 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors active:bg-muted/60 hover:bg-muted/30 ${
                        isRepeating ? "bg-amber-500/10 dark:bg-amber-500/15" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground text-xs truncate">
                          {s.full_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[10px]">{s.index_number}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="font-medium text-foreground/80">L{s.level}</span>
                          {s.program && (
                            <>
                              <span className="text-muted-foreground/50">·</span>
                              <span className="truncate max-w-[140px]">{s.program}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Pill Badge */}
                      <div className="shrink-0">
                        {isRepeating ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-900 border border-amber-300 dark:text-amber-200">
                            <RotateCcw className="size-3 text-amber-600 dark:text-amber-400" />
                            Repeat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 dark:text-emerald-300">
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                            → {targetLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                    <Users className="size-6 text-muted-foreground/40 mb-1" />
                    <span>
                      {showOnlyRepeaters
                        ? "No students currently marked to repeat."
                        : "No matching students found."}
                    </span>
                    <span className="text-[11px]">
                      {showOnlyRepeaters
                        ? "Tap any student above to mark them as repeating their current class level."
                        : "Try a different search query or level filter."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2 border-t flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span>
                  <b className="text-foreground font-semibold">{promoteCount}</b> to promote ·{" "}
                  <b className="text-amber-700 dark:text-amber-400 font-semibold">{repeatCount}</b> repeating
                </span>
                {repeatCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setRepeatIds(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Reset repeaters
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link to={"/students" as string} className="w-1/3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-9"
                    disabled={executing}
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  className="w-2/3 text-xs h-9 font-semibold"
                  onClick={handlePromote}
                  disabled={executing || promoteCount === 0}
                >
                  <GraduationCap className="size-4 mr-1.5" />
                  {executing ? "Promoting..." : `Promote (${promoteCount})`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
