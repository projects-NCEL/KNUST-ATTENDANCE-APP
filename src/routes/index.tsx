import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { QrCode, ShieldCheck, BarChart3, CalendarCheck } from "lucide-react";
import { useEffect } from "react";
import { firebaseAuth } from "@/integrations/firebase/config";
import heroImage from "@/assets/knust-students-hero.jpg";
import { KnustEmblem } from "@/components/KnustEmblem";
import { PublicFooter } from "@/components/PublicFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KNUST-ATTENDANCE-APP — Official Student Attendance System" },
      {
        name: "description",
        content:
          "KNUST-ATTENDANCE-APP is a secure QR attendance system for KNUST. Scan. Verify. Attend. Instant reports, geofenced self check-in, exportable records.",
      },
      { property: "og:title", content: "KNUST-ATTENDANCE-APP — Official Student Attendance System" },
      {
        property: "og:description",
        content:
          "KNUST-ATTENDANCE-APP is a secure QR attendance system for KNUST. Scan. Verify. Attend. Instant reports, geofenced self check-in, exportable records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KNUST-ATTENDANCE-APP — Official Student Attendance System" },
      {
        name: "twitter:description",
        content:
          "KNUST-ATTENDANCE-APP is a secure QR attendance system for KNUST. Scan. Verify. Attend. Instant reports, geofenced self check-in, exportable records.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    if (firebaseAuth.currentUser) {
      navigate({ to: "/dashboard" });
    }
  }, [navigate]);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-10 rounded-xl bg-muted/40 p-0.5 shadow-xs border flex items-center justify-center shrink-0">
              <KnustEmblem size={34} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-bold truncate text-foreground">KNUST-ATTENDANCE-APP</div>
              <div className="text-xs text-muted-foreground truncate">Kwame Nkrumah University of Science and Technology</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={"/student" as string}>
              <Button variant="outline">Student Portal</Button>
            </Link>
            <Link to={"/auth" as string}>
              <Button>Lecturer Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative bg-[#001f0f] text-primary-foreground overflow-hidden min-h-[460px] md:min-h-[520px] flex items-center">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <img
            src={heroImage}
            alt="Real KNUST students on campus"
            fetchPriority="high"
            decoding="async"
            width={1376}
            height={768}
            className="absolute inset-0 w-full h-full object-cover object-[center_35%] brightness-100"
            referrerPolicy="no-referrer"
          />
          {/* Subtle directional gradient on left only — students on center and right remain completely visible */}
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/10" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24 w-full">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-gold text-xs font-semibold uppercase tracking-wider mb-4">
              <span className="size-2 rounded-full bg-gold animate-pulse" />
              KNUST Smart Campus Attendance
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-white drop-shadow-md">
              Digital Attendance for KNUST
            </h1>
            <p className="mt-3.5 text-white/90 text-base sm:text-lg leading-relaxed drop-shadow max-w-md">
              Fast QR check-ins, automated 75% exam eligibility tracking, and instant reports for lecturers and students.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to={"/auth" as string}>
                <Button size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold shadow-md">
                  Lecturer Portal
                </Button>
              </Link>
              <Link to={"/student" as string}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/50 bg-black/30 backdrop-blur-xs text-white hover:bg-white/20 font-semibold"
                >
                  Student Portal
                </Button>
              </Link>
              <Link to={"/manual" as string}>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white/90 hover:text-white hover:bg-white/10"
                >
                  User Guide
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards placed cleanly below the hero image so they don't obstruct the students */}
      <section className="border-b bg-muted/40 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { i: QrCode, t: "Universal QR Pass", d: "One personal pass valid for all courses & class sessions." },
              { i: ShieldCheck, t: "Exam Threshold", d: "Mandatory 75% attendance tracking and instant alerts." },
              { i: BarChart3, t: "Instant Reports", d: "Automated Excel, CSV, and official PDF exam rosters." },
              { i: CalendarCheck, t: "Multi-Mode Scan", d: "Projector broadcast, live camera scan, or mobile." },
            ].map((f) => (
              <div
                key={f.t}
                className="rounded-xl bg-card p-5 border shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <f.i className="size-5 text-primary" />
                </div>
                <div className="font-semibold text-foreground text-base mb-1">{f.t}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
