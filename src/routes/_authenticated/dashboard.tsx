import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { firestoreDb, firebaseAuth } from "@/integrations/firebase/config";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Qmark Faculty Portal" },
      {
        name: "description",
        content: "Faculty portal for Qmark: Next-gen attendance verification, courses, sessions, scanner, and reports.",
      },
    ],
  }),
  component: Dashboard,
});

interface SessionItem {
  id: string;
  course_code: string;
  course_title: string;
  type: string;
  venue: string;
  start_time: string;
  duration: string;
  status: string;
}

interface ScanRecordItem {
  id: string;
  student_name: string;
  index_number: string;
  time: string;
}

function Dashboard() {
  const { user } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionItem[]>([]);
  const [todayScans, setTodayScans] = useState<ScanRecordItem[]>([]);
  const [todayCount, setTodayCount] = useState<number>(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Formatted date string matching prototype: "Mon · 5 October"
  const formattedDate = new Date()
    .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" })
    .replace(",", " ·");

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Lecturer";

  useEffect(() => {
    if (!currentUid) return;

    // 1. Fetch courses to map code & title
    const coursesMap = new Map<string, any>();
    getDocs(query(collection(firestoreDb, "courses"), where("owner_id", "==", currentUid)))
      .then((snap) => {
        snap.docs.forEach((d) => coursesMap.set(d.id, d.data()));
      })
      .catch(() => {});

    // 2. Listen to today's sessions
    const unsubSessions = onSnapshot(
      query(collection(firestoreDb, "attendance_sessions"), where("owner_id", "==", currentUid)),
      (snap) => {
        const list: SessionItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const course = data.course_id ? coursesMap.get(data.course_id) : null;
          return {
            id: d.id,
            course_code: course?.code || data.course_code || "PE 258",
            course_title: course?.title || data.course_title || "Lecture",
            type: data.session_type || "Lecture",
            venue: data.venue || data.room || "Room LT2",
            start_time: data.start_time || "10:00",
            duration: data.duration || "2 hrs",
            status: data.status || "OPEN",
          };
        });

        // Find active open session or first available session
        const live = list.find((s) => s.status === "OPEN") || list[0] || null;
        setActiveSession(live);
        setUpcomingSessions(list.filter((s) => s.id !== live?.id).slice(0, 4));
      },
    );

    // 3. Listen to today's scans (max 5 records)
    const unsubScans = onSnapshot(
      query(
        collection(firestoreDb, "attendance_records"),
        where("owner_id", "==", currentUid),
        where("session_date", "==", todayStr),
      ),
      async (snap) => {
        setTodayCount(snap.size);

        const sortedDocs = snap.docs
          .sort((a, b) => ((b.data() as any).created_at || "").localeCompare((a.data() as any).created_at || ""))
          .slice(0, 5);

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

        const items: ScanRecordItem[] = sortedDocs.map((d) => {
          const data = d.data() as any;
          const st = studentMap.get(data.student_id);
          const timeStr = data.check_in_at || data.created_at || new Date().toISOString();
          return {
            id: d.id,
            student_name: st?.name || data.student_name || "Student",
            index_number: st?.index || data.index_number || "",
            time: new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        });

        setTodayScans(items);
      },
    );

    return () => {
      unsubSessions();
      unsubScans();
    };
  }, [currentUid, todayStr]);

  // Default fallback hero details if no custom session yet
  const heroCode = activeSession?.course_code || "PE 258";
  const heroTitle = activeSession?.course_title || "Lecture";
  const heroVenue = activeSession?.venue || "Room LT2";
  const heroTime = activeSession?.start_time ? `${activeSession.start_time} – 12:00` : "10:00 – 12:00";
  const heroWhen = activeSession?.status === "OPEN" ? "Live Now" : "Next up";
  const scanLink = activeSession ? `/scan?session=${activeSession.id}` : "/scan";

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 pb-20 space-y-6 sm:space-y-8 dash-scope">
        <style>{`
          .dash-scope {
            --ink: #071733;
            --navy-1: #06142F;
            --navy-2: #0C2656;
            --navy-3: #1A4A9C;
            --gold: #D9B64A;
            --gold-hi: #F3DB8B;
            --gold-lo: #B8922A;
            --muted: #6F7C99;
            --line: rgba(10, 31, 68, .07);
            --ease: cubic-bezier(.22, 1, .36, 1);
          }

          /* entrance animations */
          .dash-in {
            opacity: 0;
            transform: translateY(18px);
            animation: dashRise .8s var(--ease) forwards;
            animation-delay: var(--d, 0s);
          }
          @keyframes dashRise {
            to {
              opacity: 1;
              transform: none;
            }
          }

          /* ---------- greeting ---------- */
          .dash-hello {
            margin: 12px 0 18px;
          }
          .dash-hello .d {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .09em;
            text-transform: uppercase;
            color: var(--muted);
          }
          .dash-hello h1 {
            margin: 6px 0 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -.035em;
            line-height: 1.08;
            color: var(--ink);
          }
          @media (min-width: 640px) {
            .dash-hello h1 {
              font-size: 38px;
            }
          }
          .dark .dash-hello h1 {
            color: #FFFFFF;
          }
          .dash-hello h1 span {
            background: linear-gradient(100deg, #0C2656, #1A4A9C);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
          .dark .dash-hello h1 span {
            background: linear-gradient(100deg, #F3DB8B, #D9B64A);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }

          /* ---------- hero with wavy, moving bottom edge ---------- */
          .dash-hero-wrap {
            filter: drop-shadow(0 22px 22px rgba(12,38,86,.30));
          }
          .dash-hero {
            --wave: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 0H360V16C300 30 240 30 180 16C120 2 60 2 0 16Z'/%3E%3C/svg%3E");
            position: relative;
            padding: 24px 22px 58px;
            color: #fff;
            overflow: hidden;
            border-radius: 30px 30px 0 0;
            background:
              radial-gradient(260px 220px at 92% 0%, rgba(243,219,139,.30), transparent 70%),
              radial-gradient(300px 260px at 0% 100%, rgba(26,74,156,.75), transparent 70%),
              linear-gradient(155deg, var(--navy-1) 0%, var(--navy-2) 55%, #123A7E 100%);
            -webkit-mask: linear-gradient(#000, #000) 0 0 / 100% calc(100% - 29px) no-repeat, var(--wave) 0 100% / 360px 30px repeat-x;
                    mask: linear-gradient(#000, #000) 0 0 / 100% calc(100% - 29px) no-repeat, var(--wave) 0 100% / 360px 30px repeat-x;
            animation: dashEdge 9s linear infinite;
          }
          @media (min-width: 768px) {
            .dash-hero {
              padding: 32px 32px 64px;
            }
          }
          @keyframes dashEdge {
            to {
              -webkit-mask-position: 0 0, 360px 100%;
              mask-position: 0 0, 360px 100%;
            }
          }

          /* rim light that travels with the edge */
          .dash-hero::before,
          .dash-hero::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 30px;
            pointer-events: none;
            background-repeat: repeat-x;
            background-size: 360px 30px;
          }
          .dash-hero::before {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 0H360V13C300 27 240 27 180 13C120 -1 60 -1 0 13Z' fill='white' fill-opacity='.07'/%3E%3C/svg%3E");
            background-position: 180px 0;
            animation: dashDriftR 13s linear infinite;
          }
          .dash-hero::after {
            bottom: 2px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 14C60 0 120 0 180 14C240 28 300 28 360 14' fill='none' stroke='%23F3DB8B' stroke-opacity='.55' stroke-width='1.6'/%3E%3C/svg%3E");
            animation: dashDrift 9s linear infinite;
          }
          @keyframes dashDrift {
            to {
              background-position: 360px 0;
            }
          }
          @keyframes dashDriftR {
            from {
              background-position: 180px 0;
            }
            to {
              background-position: -180px 0;
            }
          }

          /* radar rings */
          .dash-rings {
            position: absolute;
            right: -50px;
            top: -50px;
            width: 190px;
            height: 190px;
            pointer-events: none;
          }
          .dash-rings i {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 1px solid rgba(243,219,139,.35);
            animation: dashPing 4.5s ease-out infinite;
          }
          .dash-rings i:nth-child(2) {
            animation-delay: 1.5s;
          }
          .dash-rings i:nth-child(3) {
            animation-delay: 3s;
          }
          @keyframes dashPing {
            0% {
              transform: scale(.35);
              opacity: .9;
            }
            100% {
              transform: scale(1.1);
              opacity: 0;
            }
          }

          .dash-row {
            position: relative;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .dash-eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .14em;
            text-transform: uppercase;
            color: var(--gold-hi);
          }
          .dash-eyebrow svg {
            width: 15px;
            height: 15px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
          }
          .dash-when {
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 20px;
            color: var(--gold-hi);
            background: rgba(243,219,139,.10);
            border: 1px solid rgba(243,219,139,.28);
            backdrop-filter: blur(6px);
          }
          .dash-hero h2 {
            position: relative;
            margin: 16px 0 6px;
            font-weight: 800;
            letter-spacing: -.04em;
            line-height: 1.05;
          }
          .dash-hero h2 em {
            font-style: normal;
            font-weight: 500;
            color: rgba(255,255,255,.55);
          }
          .dash-hero .meta {
            position: relative;
            margin: 0;
            font-weight: 500;
            color: rgba(255,255,255,.68);
          }

          .dash-go {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 58px;
            border: 0;
            border-radius: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font: 800 16px 'Manrope', sans-serif;
            letter-spacing: -.01em;
            color: var(--ink);
            background: linear-gradient(180deg, var(--gold-hi) 0%, var(--gold) 55%, var(--gold-lo) 100%);
            box-shadow: 0 10px 24px rgba(217,182,74,.35), inset 0 1px 0 rgba(255,255,255,.7);
            transition: transform .25s var(--ease), box-shadow .25s var(--ease);
          }
          .dash-go::after {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            width: 60px;
            left: -80px;
            transform: skewX(-20deg);
            background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
            animation: dashSheen 3.8s ease-in-out infinite 1.2s;
          }
          @keyframes dashSheen {
            0%, 55% {
              left: -80px;
            }
            100% {
              left: 120%;
            }
          }
          .dash-go:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 30px rgba(217,182,74,.45), inset 0 1px 0 rgba(255,255,255,.7);
          }
          .dash-go:active {
            transform: scale(.97);
          }
          .dash-scan-ico {
            position: relative;
            width: 22px;
            height: 22px;
          }
          .dash-scan-ico svg {
            width: 22px;
            height: 22px;
            stroke: var(--ink);
            fill: none;
            stroke-width: 2.2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .dash-scan-ico b {
            position: absolute;
            left: 4px;
            right: 4px;
            height: 2px;
            border-radius: 2px;
            background: var(--ink);
            animation: dashLine 2s ease-in-out infinite;
          }
          @keyframes dashLine {
            0%, 100% {
              top: 5px;
            }
            50% {
              top: 15px;
            }
          }

          .dash-alt {
            position: relative;
            display: block;
            margin: 12px auto 0;
            width: max-content;
            font-size: 13px;
            font-weight: 600;
            color: rgba(255,255,255,.72);
            text-decoration: none;
            padding-bottom: 2px;
            background: linear-gradient(var(--gold-hi), var(--gold-hi)) 0 100% / 0 1px no-repeat;
            transition: background-size .35s var(--ease), color .2s;
          }
          .dash-alt:hover {
            color: #fff;
            background-size: 100% 1px;
          }

          /* ---------- later today ---------- */
          .dash-sec {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin: 24px 4px 12px;
          }
          .dash-sec h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -.02em;
            color: var(--ink);
          }
          .dark .dash-sec h3 {
            color: #FFFFFF;
          }
          .dash-sec a {
            font-size: 13px;
            font-weight: 700;
            color: var(--navy-3);
            text-decoration: none;
          }
          .dark .dash-sec a {
            color: var(--gold-hi);
          }

          .dash-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 18px;
            border-radius: 20px;
            background: rgba(255,255,255,.85);
            backdrop-filter: blur(10px);
            border: 1px solid var(--line);
            box-shadow: 0 6px 18px rgba(12,38,86,.06);
            transition: transform .3s var(--ease), box-shadow .3s var(--ease);
            text-decoration: none;
            color: inherit;
          }
          .dark .dash-item {
            background: rgba(12,38,86,.35);
            border: 1px solid rgba(255,255,255,.08);
            box-shadow: 0 6px 18px rgba(0,0,0,.25);
          }
          .dash-item:hover {
            transform: translateX(4px);
            box-shadow: 0 12px 26px rgba(12,38,86,.11);
          }
          .dash-item .t {
            width: 48px;
            text-align: center;
            font-weight: 800;
            font-size: 15px;
            letter-spacing: -.02em;
            line-height: 1.1;
            color: var(--ink);
          }
          .dark .dash-item .t {
            color: #FFFFFF;
          }
          .dash-item .t small {
            display: block;
            margin-top: 2px;
            font-size: 10px;
            font-weight: 600;
            color: var(--muted);
            letter-spacing: 0;
          }
          .dash-item .bar {
            width: 3.5px;
            align-self: stretch;
            border-radius: 3px;
            background: linear-gradient(180deg, var(--gold-hi), var(--gold-lo));
          }
          .dash-item .n {
            flex: 1;
            min-width: 0;
          }
          .dash-item .n b {
            display: block;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: -.01em;
            color: var(--ink);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .dark .dash-item .n b {
            color: #FFFFFF;
          }
          .dash-item .n span {
            font-size: 12px;
            color: var(--muted);
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
          }
          .dash-item svg {
            width: 18px;
            height: 18px;
            stroke: #9AA5BF;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            transition: transform .3s var(--ease);
            flex-shrink: 0;
          }
          .dash-item:hover svg {
            transform: translateX(3px);
            stroke: var(--navy-2);
          }
          .dark .dash-item:hover svg {
            stroke: var(--gold-hi);
          }

          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
            .dash-in {
              opacity: 1;
              transform: none;
            }
          }
        `}</style>

        {/* ---------- Greeting ---------- */}
        <div className="dash-hello dash-in flex flex-col sm:flex-row sm:items-end justify-between gap-4" style={{ "--d": ".08s" } as any}>
          <div>
            <div className="d">{formattedDate}</div>
            <h1>
              Welcome, <span>{displayName}</span>
            </h1>
          </div>

          {/* Quick status & scan count on wide screens */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/70 dark:bg-white/10 border border-black/5 dark:border-white/10 backdrop-blur-md shadow-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground">Today's Scans:</span>
              <span className="text-sm font-bold text-foreground font-mono">{todayCount}</span>
            </div>
          </div>
        </div>

        {/* ---------- Hero with curly, moving bottom edge ---------- */}
        <div className="dash-hero-wrap dash-in" style={{ "--d": ".18s" } as any}>
          <section className="dash-hero">
            <div className="dash-rings">
              <i></i>
              <i></i>
              <i></i>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="dash-row justify-start gap-3">
                  <span className="dash-eyebrow">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    {heroWhen}
                  </span>
                  <span className="dash-when">
                    {activeSession?.status === "OPEN" ? "Live Session" : "Today"}
                  </span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                  {heroCode} <em>{heroTitle}</em>
                </h2>
                <p className="meta text-sm sm:text-base">{heroTime} &nbsp;·&nbsp; {heroVenue}</p>
              </div>

              <div className="flex flex-col items-center md:items-end shrink-0 w-full md:w-auto">
                <Link to={scanLink as string} className="w-full md:w-auto" style={{ textDecoration: "none" }}>
                  <button className="dash-go md:min-w-[260px] md:px-8" id="go">
                    <span className="dash-scan-ico">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                      </svg>
                      <b></b>
                    </span>
                    Start scanning
                  </button>
                </Link>

                <Link to={"/sessions" as string} className="dash-alt">
                  or create a new session
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* ---------- Later today / Activity Stream ---------- */}
        <div className="space-y-3">
          <div className="dash-sec dash-in" style={{ "--d": ".32s" } as any}>
            <h3>{upcomingSessions.length > 0 ? "Later today" : todayScans.length > 0 ? "Today's scans" : "Class Schedule"}</h3>
            <Link to={"/sessions" as string}>See all</Link>
          </div>

          {/* Responsive multi-column grid that fills the width of any screen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* List of upcoming sessions if scheduled */}
            {upcomingSessions.length > 0 &&
              upcomingSessions.map((item, idx) => (
                <Link
                  to={`/scan?session=${item.id}` as string}
                  key={item.id}
                  className="dash-item dash-in"
                  style={{ "--d": `${0.4 + idx * 0.08}s` } as any}
                >
                  <div className="t">
                    {item.start_time}
                    <small>{item.duration}</small>
                  </div>
                  <div className="bar" />
                  <div className="n">
                    <b>{item.course_code}</b>
                    <span>{item.type} · {item.venue}</span>
                  </div>
                  <svg viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}

            {/* If no upcoming sessions, display today's recorded attendance scans (max 5) */}
            {upcomingSessions.length === 0 && todayScans.length > 0 &&
              todayScans.map((item, idx) => (
                <Link
                  to={"/reports" as string}
                  key={item.id}
                  className="dash-item dash-in"
                  style={{ "--d": `${0.4 + idx * 0.08}s` } as any}
                >
                  <div className="t">
                    {item.time}
                    <small>Present</small>
                  </div>
                  <div className="bar" />
                  <div className="n">
                    <b>{item.student_name}</b>
                    <span>{item.index_number} · Verified Scan</span>
                  </div>
                  <svg viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}

            {/* Sample default schedule items matching prototype if brand-new account */}
            {upcomingSessions.length === 0 && todayScans.length === 0 && (
              <>
                <Link
                  to={"/sessions" as string}
                  className="dash-item dash-in"
                  style={{ "--d": ".42s" } as any}
                >
                  <div className="t">
                    14:00
                    <small>2 hrs</small>
                  </div>
                  <div className="bar" />
                  <div className="n">
                    <b>MATH 252</b>
                    <span>Tutorial · Room 105</span>
                  </div>
                  <svg viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link
                  to={"/sessions" as string}
                  className="dash-item dash-in"
                  style={{ "--d": ".5s" } as any}
                >
                  <div className="t">
                    16:30
                    <small>1 hr</small>
                  </div>
                  <div className="bar" />
                  <div className="n">
                    <b>PE 262</b>
                    <span>Lecture · Room LT4</span>
                  </div>
                  <svg viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
