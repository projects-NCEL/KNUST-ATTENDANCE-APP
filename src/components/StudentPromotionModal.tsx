import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  RotateCcw,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { doc, writeBatch, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { firestoreDb, firebaseAuth } from "@/integrations/firebase/config";

interface StudentPromotionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: any[];
  levels: string[];
  onSuccess: () => void;
}

export function StudentPromotionModal({
  open,
  onOpenChange,
  students,
  levels,
  onSuccess,
}: StudentPromotionModalProps) {
  // Promotion mode: "cascade" (all classes step up) or "single" (one specific class)
  const [mode, setMode] = useState<"cascade" | "single">("cascade");
  const [sourceLevel, setSourceLevel] = useState<string>(levels[0] || "100");
  const [targetLevel, setTargetLevel] = useState<string>(levels[1] || "200");
  const [graduatedLabel, setGraduatedLabel] = useState<string>("Graduated");

  // IDs of students selected to REPEAT (stay in their current class)
  const [repeatIds, setRepeatIds] = useState<Set<string>>(new Set());

  // Search & view filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "promoting" | "repeating">("all");

  const [executing, setExecuting] = useState(false);

  // Sorted levels array
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => {
      const an = parseInt(a, 10),
        bn = parseInt(b, 10);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.localeCompare(b);
    });
  }, [levels]);

  // Determine destination level for a given current level in cascade mode
  const getNextLevelCascade = (currentLvl: string): string => {
    const idx = sortedLevels.indexOf(currentLvl);
    if (idx === -1) return currentLvl;
    if (idx === sortedLevels.length - 1) {
      return graduatedLabel;
    }
    return sortedLevels[idx + 1];
  };

  // Determine target for any student based on mode
  const getStudentTargetLevel = (student: any): string => {
    const current = String(student.level || "").trim();
    if (mode === "single") {
      return current === sourceLevel ? targetLevel : current;
    }
    return getNextLevelCascade(current);
  };

  // Filter students eligible for promotion in the current configuration
  const eligibleStudents = useMemo(() => {
    return (students ?? []).filter((s) => {
      if (mode === "single") {
        return String(s.level) === sourceLevel;
      }
      return sortedLevels.includes(String(s.level));
    });
  }, [students, mode, sourceLevel, sortedLevels]);

  // Filtered view list for the student review table
  const displayStudents = useMemo(() => {
    let list = eligibleStudents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.index_number?.toLowerCase().includes(q) ||
          s.program?.toLowerCase().includes(q),
      );
    }
    if (filterLevel !== "all") {
      list = list.filter((s) => String(s.level) === filterLevel);
    }
    if (decisionFilter === "repeating") {
      list = list.filter((s) => repeatIds.has(s.id));
    } else if (decisionFilter === "promoting") {
      list = list.filter((s) => !repeatIds.has(s.id));
    }
    return list;
  }, [eligibleStudents, searchQuery, filterLevel, decisionFilter, repeatIds]);

  // Toggle repeating status for an individual student
  const toggleRepeat = (studentId: string) => {
    setRepeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // Bulk actions for visible students
  const markFilteredToRepeat = () => {
    setRepeatIds((prev) => {
      const next = new Set(prev);
      displayStudents.forEach((s) => next.add(s.id));
      return next;
    });
    toast.info(`Marked ${displayStudents.length} student(s) to repeat`);
  };

  const markFilteredToPromote = () => {
    setRepeatIds((prev) => {
      const next = new Set(prev);
      displayStudents.forEach((s) => next.delete(s.id));
      return next;
    });
    toast.info(`Marked ${displayStudents.length} student(s) to promote`);
  };

  const clearAllRepeaters = () => {
    setRepeatIds(new Set());
    toast.info("Reset all students to promote");
  };

  // Stats
  const totalEligible = eligibleStudents.length;
  const repeatCount = eligibleStudents.filter((s) => repeatIds.has(s.id)).length;
  const promoteCount = totalEligible - repeatCount;

  // First class info (e.g. Level 100)
  const firstLevel = sortedLevels[0] || "100";
  const firstLevelStudents = (students ?? []).filter((s) => String(s.level) === firstLevel);
  const firstLevelRepeaters = firstLevelStudents.filter((s) => repeatIds.has(s.id)).length;

  // Execute promotion
  const handlePromote = async () => {
    if (promoteCount === 0) {
      toast.error("No students are set to be promoted");
      return;
    }

    setExecuting(true);
    const toastId = toast.loading("Executing class promotions...");
    const currentUid = firebaseAuth.currentUser?.uid;

    try {
      // 1. Prepare student updates
      // Students to update: eligible students who are NOT in repeatIds
      const studentsToPromote = eligibleStudents.filter((s) => !repeatIds.has(s.id));

      // Group students by current level to promote from highest to lowest
      // (This avoids potential collisions in level capacity)
      const promotionPlan: { student: any; nextLevel: string }[] = studentsToPromote.map((s) => ({
        student: s,
        nextLevel: getStudentTargetLevel(s),
      }));

      // Sort plan so highest levels are updated first (e.g. 400 -> Graduated, then 300 -> 400, etc.)
      promotionPlan.sort((a, b) => {
        const idxA = sortedLevels.indexOf(String(a.student.level));
        const idxB = sortedLevels.indexOf(String(b.student.level));
        return idxB - idxA;
      });

      // 2. Ensure destination levels exist in class_levels if needed
      if (currentUid && mode === "cascade" && graduatedLabel) {
        try {
          const snap = await getDocs(
            query(
              collection(firestoreDb, "class_levels"),
              where("owner_id", "==", currentUid),
              where("name", "==", graduatedLabel),
            ),
          );
          if (snap.empty) {
            await addDoc(collection(firestoreDb, "class_levels"), {
              name: graduatedLabel,
              owner_id: currentUid,
            });
          }
        } catch {
          // ignore error adding graduated level
        }
      }

      // 3. Write updates in Firestore batches of 200
      const batchSize = 200;
      for (let i = 0; i < promotionPlan.length; i += batchSize) {
        const chunk = promotionPlan.slice(i, i + batchSize);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(({ student, nextLevel }) => {
          const ref = doc(firestoreDb, "students", student.id);
          batch.update(ref, { level: nextLevel });
        });
        await batch.commit();
      }

      toast.success(
        `✓ Promotion complete: ${promotionPlan.length} students promoted. ${repeatCount} student(s) retained to repeat.`,
        { id: toastId },
      );

      if (mode === "cascade") {
        toast.info(
          `Level ${firstLevel} now has ${firstLevelRepeaters} repeater(s) and is ready for fresh student imports!`,
        );
      }

      onSuccess();
      onOpenChange(false);
      setRepeatIds(new Set());
    } catch (err: any) {
      console.error("Promotion failed:", err);
      toast.error(err?.message || "Failed to execute promotions", { id: toastId });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Students Class Promotion</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Bulk promote classes to their next academic level and easily select any students who
                need to repeat.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* MODE TABS */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-sm">
          <button
            type="button"
            className={`py-2 px-3 rounded-md font-medium text-xs transition-all flex items-center justify-center gap-2 ${
              mode === "cascade"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("cascade")}
          >
            <Sparkles className="size-3.5" />
            Academic Year Cascade (All Classes Roll-Over)
          </button>
          <button
            type="button"
            className={`py-2 px-3 rounded-md font-medium text-xs transition-all flex items-center justify-center gap-2 ${
              mode === "single"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("single")}
          >
            <ArrowRight className="size-3.5" />
            Promote Single Class
          </button>
        </div>

        {/* PROGRESSION OVERVIEW */}
        {mode === "cascade" ? (
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Full Academic Roll-over Pathway
              </span>
              <span className="text-xs text-muted-foreground">
                First class (Level {firstLevel}) clears for fresh student imports
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap py-1">
              {sortedLevels.map((lvl, i) => {
                const count = (students ?? []).filter((s) => String(s.level) === lvl).length;
                const next = getNextLevelCascade(lvl);
                return (
                  <div key={lvl} className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-background border shadow-xs">
                      <span className="font-bold text-foreground">Level {lvl}</span>
                      <span className="text-muted-foreground">({count})</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span className="font-semibold text-primary">{next}</span>
                    </div>
                    {i < sortedLevels.length - 1 && <span className="text-muted-foreground">·</span>}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-primary/10">
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
              <span>
                <b>Level {firstLevel} Fresh Intake:</b> All students in Level {firstLevel} move to{" "}
                {sortedLevels[1] || "Level 200"}, leaving Level {firstLevel} ready for incoming
                freshmen imports (except students marked to repeat).
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 p-3 grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Source Class (moving from)</Label>
              <Select value={sourceLevel} onValueChange={setSourceLevel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedLevels.map((l) => (
                    <SelectItem key={l} value={l}>
                      Level {l} ({(students ?? []).filter((s) => String(s.level) === l).length}{" "}
                      students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target Class (moving to)</Label>
              <Select value={targetLevel} onValueChange={setTargetLevel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedLevels.map((l) => (
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

        {/* STATS BAR & QUICK ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted font-medium">
              Total: <b>{totalEligible}</b> students
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              Promoting: <b>{promoteCount}</b>
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                repeatCount > 0 ? "bg-amber-100 text-amber-900 font-bold" : "bg-muted text-muted-foreground"
              }`}
            >
              Repeating: <b>{repeatCount}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={markFilteredToRepeat}
              disabled={displayStudents.length === 0}
            >
              <RotateCcw className="size-3 mr-1 text-amber-600" />
              Mark Filtered as Repeat
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={markFilteredToPromote}
              disabled={displayStudents.length === 0}
            >
              <CheckCircle2 className="size-3 mr-1 text-emerald-600" />
              Mark Filtered as Promote
            </Button>
            {repeatCount > 0 && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearAllRepeaters}>
                Reset All
              </Button>
            )}
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or index number..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          {mode === "cascade" && (
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {sortedLevels.map((l) => (
                  <SelectItem key={l} value={l}>
                    Level {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={decisionFilter}
            onValueChange={(v) => setDecisionFilter(v as "all" | "promoting" | "repeating")}
          >
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions ({eligibleStudents.length})</SelectItem>
              <SelectItem value="promoting">Promoting ({promoteCount})</SelectItem>
              <SelectItem value="repeating">Repeating ({repeatCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* STUDENT SELECTION TABLE */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[220px] max-h-[340px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10 text-left border-b">
              <tr>
                <th className="p-2.5">Student</th>
                <th className="p-2.5">Index Number</th>
                <th className="p-2.5">Current Class</th>
                <th className="p-2.5">Destination Class</th>
                <th className="p-2.5 text-right">Promotion Decision</th>
              </tr>
            </thead>
            <tbody>
              {displayStudents.map((s) => {
                const isRepeating = repeatIds.has(s.id);
                const destination = isRepeating
                  ? `Level ${s.level} (Repeat)`
                  : getStudentTargetLevel(s);

                return (
                  <tr
                    key={s.id}
                    className={`border-b transition-colors hover:bg-muted/40 cursor-pointer ${
                      isRepeating ? "bg-amber-50/70 dark:bg-amber-950/20" : ""
                    }`}
                    onClick={() => toggleRepeat(s.id)}
                  >
                    <td className="p-2.5 font-medium">
                      <div className="font-semibold text-foreground">{s.full_name}</div>
                      {s.program && (
                        <div className="text-[11px] text-muted-foreground">{s.program}</div>
                      )}
                    </td>
                    <td className="p-2.5 font-mono">{s.index_number}</td>
                    <td className="p-2.5">
                      <span className="font-medium">Level {s.level}</span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`font-semibold ${
                          isRepeating ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {destination}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      {isRepeating ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRepeat(s.id);
                          }}
                        >
                          <RotateCcw className="size-3 mr-1" />
                          Repeating Level {s.level}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRepeat(s.id);
                          }}
                        >
                          <ArrowRight className="size-3 mr-1" />
                          Promote to {getStudentTargetLevel(s)}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No students match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM ACTION */}
        <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            Click any row or button to toggle between <b>Promote</b> and <b>Repeat</b>.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={executing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePromote}
              disabled={executing || promoteCount === 0}
              className="text-xs font-semibold"
            >
              <GraduationCap className="size-4 mr-1.5" />
              {executing
                ? "Promoting..."
                : `Execute Promotion (${promoteCount} Promoted, ${repeatCount} Repeating)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
