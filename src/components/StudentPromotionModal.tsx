import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  ArrowRight,
  RotateCcw,
  Search,
  GraduationCap,
  Sparkles,
  Check,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { doc, writeBatch, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { firestoreDb, firebaseAuth } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  // Mode: "cascade" (all classes step up) or "single" (one class)
  const [mode, setMode] = useState<"cascade" | "single">("cascade");
  const [sourceLevel, setSourceLevel] = useState<string>(levels[0] || "100");
  const [targetLevel, setTargetLevel] = useState<string>(levels[1] || "200");

  // IDs of students marked to repeat
  const [repeatIds, setRepeatIds] = useState<Set<string>>(new Set());

  // Search & filters
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showOnlyRepeaters, setShowOnlyRepeaters] = useState(false);

  const [executing, setExecuting] = useState(false);

  // Sorted levels list (e.g. 100, 200, 300, 400)
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => {
      const an = parseInt(a, 10),
        bn = parseInt(b, 10);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.localeCompare(b);
    });
  }, [levels]);

  const firstLevel = sortedLevels[0] || "100";

  // Destination level in cascade mode
  const getNextLevelCascade = (currentLvl: string): string => {
    const idx = sortedLevels.indexOf(currentLvl);
    if (idx === -1) return currentLvl;
    if (idx === sortedLevels.length - 1) return "Graduated";
    return sortedLevels[idx + 1];
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
      return sortedLevels.includes(String(s.level));
    });
  }, [students, mode, sourceLevel, sortedLevels]);

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
    const toastId = toast.loading("Promoting students...");

    try {
      const studentsToPromote = eligibleStudents.filter((s) => !repeatIds.has(s.id));

      const plan = studentsToPromote.map((s) => ({
        student: s,
        nextLevel: getTargetForStudent(s),
      }));

      // Sort descending by level (e.g. 400 first, then 300, 200, 100)
      plan.sort((a, b) => {
        const idxA = sortedLevels.indexOf(String(a.student.level));
        const idxB = sortedLevels.indexOf(String(b.student.level));
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
        `Promotion complete: ${plan.length} students promoted. ${repeatCount} repeating.`,
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

      onSuccess();
      onOpenChange(false);
      setRepeatIds(new Set());
      setSearch("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute promotions", { id: toastId });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg p-3 sm:p-4 max-h-[92dvh] sm:max-h-[86vh] flex flex-col gap-2 rounded-xl overflow-hidden shadow-2xl">
        {/* COMPACT MOBILE-FRIENDLY HEADER */}
        <DialogHeader className="pb-1.5 border-b text-left">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
              <GraduationCap className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-base font-bold truncate">
                Promote Students
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Advance classes. Tap any student to toggle Repeat status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ULTRA-COMPACT SEGMENT MODE SELECTOR */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/80 rounded-lg text-xs">
          <button
            type="button"
            className={`py-1 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 text-[11px] sm:text-xs ${
              mode === "cascade"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("cascade")}
          >
            <Sparkles className="size-3 text-primary" />
            All Classes (Roll-Over)
          </button>
          <button
            type="button"
            className={`py-1 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 text-[11px] sm:text-xs ${
              mode === "single"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("single")}
          >
            <ArrowRight className="size-3" />
            Single Class
          </button>
        </div>

        {/* COMPACT PROGRESSION PATHWAY */}
        {mode === "cascade" ? (
          <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-1 text-muted-foreground mb-1">
              <span className="font-medium text-foreground">Progression</span>
              <span className="text-primary font-semibold truncate">
                L{firstLevel} clears for new admissions
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 font-medium">
              {sortedLevels.map((lvl, i) => (
                <span key={lvl} className="flex items-center gap-1 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-background border text-foreground text-[10px]">
                    L{lvl}
                  </span>
                  <ArrowRight className="size-2.5 text-muted-foreground shrink-0" />
                  {i === sortedLevels.length - 1 && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]">
                      Graduated
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">
                From Class
              </span>
              <Select value={sourceLevel} onValueChange={setSourceLevel}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedLevels.map((l) => (
                    <SelectItem key={l} value={l}>
                      Level {l} ({(students ?? []).filter((s) => String(s.level) === l).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">
                To Class
              </span>
              <Select value={targetLevel} onValueChange={setTargetLevel}>
                <SelectTrigger className="h-7 text-xs">
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

        {/* SEARCH & FILTER CONTROLS */}
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, index number..."
              className="h-7 pl-7 pr-7 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px]">
            {mode === "cascade" ? (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 transition-colors ${
                    levelFilter === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setLevelFilter("all")}
                >
                  All ({eligibleStudents.length})
                </button>
                {sortedLevels.map((l) => {
                  const count = eligibleStudents.filter((s) => String(s.level) === l).length;
                  return (
                    <button
                      key={l}
                      type="button"
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 transition-colors ${
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
              <div className="text-[11px] text-muted-foreground">
                Showing {eligibleStudents.length} student{eligibleStudents.length === 1 ? "" : "s"}
              </div>
            )}

            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ml-auto transition-colors flex items-center gap-1 ${
                showOnlyRepeaters
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setShowOnlyRepeaters(!showOnlyRepeaters)}
            >
              <RotateCcw className="size-2.5" />
              Repeaters ({repeatCount})
            </button>
          </div>
        </div>

        {/* MOBILE-SLIM STUDENT LIST */}
        <div className="flex-1 overflow-y-auto divide-y rounded-md border min-h-[170px] max-h-[44dvh] sm:max-h-[300px] bg-card">
          {filteredStudents.map((s) => {
            const isRepeating = repeatIds.has(s.id);
            const target = getTargetForStudent(s);
            const targetLabel = target === "Graduated" ? "Grad" : `L${target}`;

            return (
              <div
                key={s.id}
                onClick={() => toggleRepeat(s.id)}
                className={`px-2.5 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors active:bg-muted/60 hover:bg-muted/30 ${
                  isRepeating ? "bg-amber-500/10 dark:bg-amber-500/15" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate text-xs">
                    {s.full_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                    <span className="font-mono text-[10px]">{s.index_number}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="font-medium text-foreground/80">L{s.level}</span>
                    {s.program && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="truncate max-w-[120px]">{s.program}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* SLIM BADGE (FIT ON 320PX-360PX MOBILE) */}
                <div className="shrink-0">
                  {isRepeating ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-900 border border-amber-300 dark:text-amber-200">
                      <RotateCcw className="size-2.5 text-amber-600 dark:text-amber-400" />
                      Repeat
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 dark:text-emerald-300">
                      <Check className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                      → {targetLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1">
              <Users className="size-5 text-muted-foreground/40 mb-1" />
              <span>
                {showOnlyRepeaters
                  ? "No students marked to repeat yet."
                  : "No matching students found."}
              </span>
              <span className="text-[10px]">
                {showOnlyRepeaters
                  ? "Tap any student in the list to flag them as repeating."
                  : "Try clearing your search query."}
              </span>
            </div>
          )}
        </div>

        {/* SLIM STICKY FOOTER */}
        <div className="pt-2 border-t flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span>
              <b className="text-foreground font-semibold">{promoteCount}</b> to promote ·{" "}
              <b className="text-amber-700 dark:text-amber-400 font-semibold">{repeatCount}</b> repeating
            </span>
            {repeatCount > 0 && (
              <button
                type="button"
                onClick={() => setRepeatIds(new Set())}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Reset repeaters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-1/3 text-xs h-8"
              onClick={() => onOpenChange(false)}
              disabled={executing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-2/3 text-xs h-8 font-semibold"
              onClick={handlePromote}
              disabled={executing || promoteCount === 0}
            >
              <GraduationCap className="size-3.5 mr-1" />
              {executing ? "Promoting..." : `Promote (${promoteCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
