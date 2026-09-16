import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

async function generateManualPdf() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Read KNUST logo as base64
  let logoBase64 = null;
  try {
    const logoBuffer = fs.readFileSync("public/favicon.png");
    logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (err) {
    console.warn("Could not read logo:", err.message);
  }

  const PRIMARY_COLOR = [0, 56, 28]; // KNUST Deep Green #00381C
  const SECONDARY_COLOR = [0, 85, 43]; // KNUST Emerald #00552B
  const ACCENT_COLOR = [245, 166, 35]; // KNUST Gold #F5A623
  const TEXT_MAIN = [26, 32, 44];
  const TEXT_MUTED = [100, 116, 139];
  const BG_LIGHT = [248, 250, 252];

  function drawHeader(title = "System Architecture & Comprehensive Operations Manual") {
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", margin, 8, 14, 14);
      } catch (e) {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY_COLOR);
    doc.text("KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY", margin + 18, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`KNUST-ATTENDANCE-APP · ${title}`, margin + 18, 17);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 24, pageWidth - margin, 24);
  }

  function drawFooter(pageNumber, totalPages) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      "KNUST-ATTENDANCE-APP (QRoll) · Academic Computing Services · Kumasi, Ghana",
      margin,
      pageHeight - 7
    );
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 7);
  }

  // ==========================================
  // PAGE 1: COVER & EXECUTIVE SUMMARY
  // ==========================================
  // Dark Green Top Band
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 58, "F");

  // Gold accent strip
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 58, pageWidth, 3, "F");

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 12, 28, 28);
    } catch (e) {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("KWAME NKRUMAH UNIVERSITY OF SCIENCE & TECHNOLOGY", margin + 34, 22);

  doc.setFontSize(12);
  doc.setTextColor(245, 166, 35);
  doc.text("KNUST-ATTENDANCE-APP (QRoll)", margin + 34, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(230, 245, 235);
  doc.text("Comprehensive System Architecture, Page Directory & Operations Manual", margin + 34, 37);
  doc.text("Official Technical & User Documentation for Faculty, Staff and Students", margin + 34, 43);

  let curY = 70;

  // Metadata Card
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, curY, contentWidth, 22, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, curY, contentWidth, 22, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("Document Version:", margin + 4, curY + 6);
  doc.text("Release Status:", margin + 50, curY + 6);
  doc.text("Primary Audience:", margin + 95, curY + 6);
  doc.text("Last Updated:", margin + 150, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MAIN);
  doc.text("v2.5 (Production)", margin + 4, curY + 14);
  doc.text("Active Academic Deployment", margin + 50, curY + 14);
  doc.text("Lecturers, Tutors, Students & Admins", margin + 95, curY + 14);
  doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), margin + 150, curY + 14);

  curY += 30;

  // Executive Overview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("1. Executive Overview & Mission", margin, curY);

  curY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(...TEXT_MAIN);
  const overviewText = 
    "KNUST-ATTENDANCE-APP is a modern institutional platform engineered to eradicate proxy attendance, " +
    "streamline classroom management, automate the 10-mark continuous assessment computation, and deliver " +
    "instant real-time communication across Kwame Nkrumah University of Science and Technology. " +
    "By fusing dynamic cryptographic rotating QR codes, multi-camera scanning engines, geofencing coordinates, " +
    "PWA offline resilience, and cross-device Web Push notifications, the application delivers a frictionless, " +
    "tamper-proof attendance experience for both educators and students.";
  const splitOverview = doc.splitTextToSize(overviewText, contentWidth);
  doc.text(splitOverview, margin, curY);
  curY += splitOverview.length * 4.5 + 4;

  // Core Pillars Table
  autoTable(doc, {
    startY: curY,
    head: [["Core Architectural Pillar", "Institutional Benefit & Mechanism"]],
    body: [
      [
        "Dynamic Rolling QR Codes",
        "Tokens regenerate automatically every 10 seconds with cryptographic timestamps, preventing screenshot sharing, remote proxies, and off-campus fraudulent scans."
      ],
      [
        "Dual Scanning Paradigms",
        "Supports both Lecturer-as-Scanner (multi-camera high-speed scan with audio chime) and Student-as-Scanner (projector screen broadcast mode with live roster update)."
      ],
      [
        "Automated 10-Mark Assessment",
        "Dynamically transforms attendance counts into official 10-mark university grading scale, highlighting students below the 75% examination eligibility threshold."
      ],
      [
        "Cross-Device Web Push Alerts",
        "Instant delivery of urgent announcements, lecture session alerts, and assignment deadlines directly to student smartphone lock screens even when the browser is closed."
      ],
      [
        "Offline Attendance Caching",
        "IndexedDB local persistence allows lecturers to scan hundreds of students without active Wi-Fi, automatically synchronizing upon network re-establishment."
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  // ==========================================
  // PAGE 2: COMPLETE PAGE DIRECTORY & ROUTE MATRIX
  // ==========================================
  doc.addPage();
  drawHeader("System Page Directory & Route Matrix");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("2. Web Application Page Directory & Route Matrix", margin, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    "The application is structured into dedicated public portals, student self-service gateways, and lecturer control spaces:",
    margin,
    37
  );

  autoTable(doc, {
    startY: 42,
    head: [["Route Path", "Target Users", "Access Level", "Core Functionality & Interactive Features"]],
    body: [
      [
        "/",
        "Public / All",
        "Unauthenticated",
        "Institutional landing screen, university branding, feature previews, direct gateway navigation to Student Portal, Tutor Login, and Manual."
      ],
      [
        "/auth",
        "Lecturers / Tutors",
        "Public (Guest)",
        "Secure educator authentication with Google Single Sign-On (OAuth) or email/password. Enforces lecturer role validation."
      ],
      [
        "/student",
        "Students",
        "Index / Email",
        "Student dashboard featuring 10s rolling personal QR token, real-time push notification opt-in & history log, attendance statistics, registered courses, and coursework submissions."
      ],
      [
        "/manual",
        "All Users",
        "Public",
        "Interactive documentation, searchable guide, step-by-step guides, troubleshooting FAQs, and PDF user manual download."
      ],
      [
        "/check-in",
        "Students",
        "Self Check-In",
        "Student-facing check-in screen for entering session PIN codes or scanning projected lecture room QR tokens with geofencing validation."
      ],
      [
        "/portal/$token",
        "Students",
        "Public Token",
        "One-click enrollment link allowing students to self-enroll into specific course rosters without manual instructor data entry."
      ],
      [
        "/dashboard",
        "Lecturers / Staff",
        "Authenticated",
        "Real-time operational dashboard with active session status, daily attendance statistics, quick-action cards, recent check-in feeds, and course summaries."
      ],
      [
        "/scan",
        "Lecturers / TAs",
        "Authenticated",
        "Live high-speed multi-camera scanner supporting front/back cameras, continuous scan loop, audible chime, duplicate protection, and manual index fallback."
      ],
      [
        "/sessions",
        "Lecturers",
        "Authenticated",
        "Session hub to launch new lecture attendance sessions, customize geofencing radius, activate PIN mode, project dynamic rolling QR codes, and view live rosters."
      ],
      [
        "/courses",
        "Lecturers / Staff",
        "Authenticated",
        "Course catalog management: create/edit course codes, credit hours, departments, semesters, view class rosters, and track overall attendance percentages."
      ],
      [
        "/students",
        "Lecturers / Staff",
        "Authenticated",
        "Master student directory with multi-field search, index number filtering, profile editing, and bulk roster import via Excel (.xlsx) and CSV."
      ],
      [
        "/departments",
        "Administrators",
        "Authenticated",
        "University organizational tree: configure faculties, colleges, academic departments, and assign courses accordingly."
      ],
      [
        "/semesters",
        "Administrators",
        "Authenticated",
        "Academic calendar setup: set academic years, term dates, and switch the system-wide active semester."
      ],
      [
        "/announcements",
        "Lecturers / Staff",
        "Authenticated",
        "Publish emergency, department, or course-specific announcements with automatic Web Push dispatch to student devices."
      ],
      [
        "/assignments",
        "Lecturers & Tutors",
        "Authenticated",
        "Coursework distribution hub: set titles, descriptions, due dates, course attachments, and inspect/grade student digital submissions."
      ],
      [
        "/reports",
        "Lecturers / HODs",
        "Authenticated",
        "Continuous assessment gradebook: auto-calculates 10-mark scores, highlights <75% attendance disqualifications, and exports to formatted Excel, CSV, and official PDF."
      ],
      [
        "/history",
        "Lecturers",
        "Authenticated",
        "Immutable chronological audit log of all historical scan events with timestamps, student details, and verification methods."
      ],
      [
        "/settings",
        "Lecturers / Staff",
        "Authenticated",
        "Personal profile configuration, push notification subscription status, registered physical scanner devices, and security credentials."
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: "auto" },
    },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // ==========================================
  // PAGE 3: CORE FEATURES & OPERATIONAL MECHANICS
  // ==========================================
  doc.addPage();
  drawHeader("Detailed Feature Breakdown & Engineering");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("3. Core Feature Breakdown & Engineering Mechanics", margin, 32);

  const features = [
    {
      num: "3.1",
      title: "Dynamic Rolling Security QR Tokens (Anti-Proxy Engine)",
      badge: "Security",
      desc: "Static QR codes can be easily captured via screenshot and messaged to absentee colleagues. KNUST-ATTENDANCE-APP solves this via rolling cryptographic tokens that regenerate every 10 seconds with high-entropy randomized nonce salts and unix timestamps. When scanned, the system verifies the token's active window; expired or forward-shared screenshots are rejected instantly."
    },
    {
      num: "3.2",
      title: "High-Speed Multi-Camera Scanning Engine",
      badge: "Performance",
      desc: "Built with zxing-js and HTML5 video streaming, the scanner enables lecturers and teaching assistants to scan 50+ students per minute. Features include instant audio chime confirmation, memory-resident duplicate prevention (ignoring accidental double-scans), environmental camera toggling, torch/flashlight controls for dim halls, and manual index search fallback."
    },
    {
      num: "3.3",
      title: "Cross-Device Web Push Notifications & In-App History Feed",
      badge: "Real-Time",
      desc: "Students can subscribe their mobile phones, tablets, or laptops to native Web Push Notifications via VAPID service workers. Lecturers broadcasting urgent announcements, assignment deadlines, or class session cancellations trigger instantaneous background OS alerts on student devices even when the browser is entirely closed. Every notification is stored permanently in the student's Notification History log."
    },
    {
      num: "3.4",
      title: "Geofencing & GPS Radius Classroom Validation",
      badge: "Integrity",
      desc: "Lecturers can lock attendance sessions to a specific lecture hall by specifying target GPS coordinates and an allowable radius (e.g., 50 meters around Great Hall or College of Science). When students submit attendance from their personal devices, the browser geolocation API confirms physical presence inside the designated radius."
    },
    {
      num: "3.5",
      title: "10-Mark Continuous Assessment & 75% Exam Eligibility Engine",
      badge: "Academic",
      desc: "In accordance with KNUST academic statutes requiring 75% attendance for end-of-semester examination clearance, the platform automatically evaluates each student's attendance percentage. It assigns a standardized proportional score out of 10 marks and visually flags at-risk students who fall beneath the clearance threshold with warning badges."
    },
    {
      num: "3.6",
      title: "Offline Caching & Automated Cloud Synchronization",
      badge: "Reliability",
      desc: "Ghanaian lecture halls occasionally face intermittent cellular or Wi-Fi coverage. The application utilizes IndexedDB local caching to record and timestamp student check-ins offline. As soon as connectivity is restored, the local queue automatically pushes entries to Cloud Firestore without data loss or duplicate increments."
    }
  ];

  let fY = 38;
  features.forEach((feat) => {
    // Feature Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, fY, contentWidth, 27, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, fY, contentWidth, 27, 2, 2, "D");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(`${feat.num} ${feat.title}`, margin + 4, fY + 6);

    // Badge
    doc.setFillColor(...SECONDARY_COLOR);
    doc.roundedRect(pageWidth - margin - 24, fY + 3, 20, 5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(feat.badge, pageWidth - margin - 22, fY + 6.5);

    // Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MAIN);
    const splitDesc = doc.splitTextToSize(feat.desc, contentWidth - 8);
    doc.text(splitDesc, margin + 4, fY + 12);

    fY += 31;
  });

  // ==========================================
  // PAGE 4: OPERATIONAL WORKFLOWS (LECTURERS & STUDENTS)
  // ==========================================
  doc.addPage();
  drawHeader("Step-by-Step Operations & User Workflows");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("4. End-to-End Operational Workflows", margin, 32);

  // Workflow 1: Lecturer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text("Workflow A: Lecturer Classroom Attendance Session", margin, 40);

  autoTable(doc, {
    startY: 43,
    head: [["Step", "Action & Procedure", "Expected Result & Tips"]],
    body: [
      [
        "1",
        "Sign in at /auth via Google or Email/Password.",
        "Opens the Tutor Dashboard displaying summary metrics, active courses, and recent attendance sessions."
      ],
      [
        "2",
        "Navigate to 'Sessions' and click 'Create Session'. Select course, title, and optional Geofence.",
        "System creates an active session document with a unique session ID and dynamic security tokens."
      ],
      [
        "3",
        "Choose Mode: Click 'Launch Projector QR' OR open the 'Live Scanner' (/scan).",
        "Projector Mode displays a huge rolling QR on the hall screen; Scanner Mode turns the lecturer's phone into a high-speed scanner."
      ],
      [
        "4",
        "Scan student personal QR codes OR let students scan the projector screen.",
        "Audio chime confirms every record; duplicates are blocked; live count updates in real time on the dashboard."
      ],
      [
        "5",
        "Click 'End Session' once the lecture concludes.",
        "Closes attendance session, locks submissions, and calculates cumulative attendance stats."
      ],
      [
        "6",
        "Navigate to 'Reports' to view attendance gradebook and export to Excel, CSV, or PDF.",
        "Generates clean university grade sheets with 10-mark continuous assessment scores and exam eligibility flags."
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 14 } },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255] },
  });

  // Workflow 2: Student
  const w2Y = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text("Workflow B: Student Onboarding, Check-In & Push Notification Setup", margin, w2Y);

  autoTable(doc, {
    startY: w2Y + 3,
    head: [["Step", "Action & Procedure", "Expected Result & Tips"]],
    body: [
      [
        "1",
        "Visit /student. If visiting for the first time, click the 'Sign Up' tab.",
        "Presents the university verification form requesting Index Number and registered email."
      ],
      [
        "2",
        "Enter Index Number, registered email, and create a 6+ character password. Click 'Sign Up'.",
        "Instantly verifies enrolment in university database, secures credentials, and logs into student portal."
      ],
      [
        "3",
        "Click 'Enable Mobile Push Notifications' banner on the student portal header.",
        "Prompts browser notification permission; registers device VAPID token to receive instant broadcast alerts."
      ],
      [
        "4",
        "Present the live rotating QR badge to the lecturer's camera scanner during class.",
        "Token refreshes every 10s. Lecturer's device chimes and marks student present instantly."
      ],
      [
        "5",
        "Alternative: If lecturer is projecting, open /check-in, scan screen QR or enter 6-digit PIN.",
        "Verifies geofence location and logs attendance directly from the student's mobile device."
      ],
      [
        "6",
        "Inspect Course Roster & Submissions in the student dashboard.",
        "Shows attendance percentage, Continuous Assessment score (out of 10), exam status, and assignment tasks."
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 14 } },
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255] },
  });

  // ==========================================
  // PAGE 5: TROUBLESHOOTING, FAQ & BEST PRACTICES
  // ==========================================
  doc.addPage();
  drawHeader("Troubleshooting & Academic Guidelines");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("5. Frequently Asked Questions & Troubleshooting Guide", margin, 32);

  autoTable(doc, {
    startY: 37,
    head: [["Scenario / Question", "Root Cause & Resolution Step"]],
    body: [
      [
        "Camera not opening in Scanner (/scan)?",
        "Ensure browser permissions for camera are granted (Settings -> Site permissions -> Camera -> Allow). On iOS Safari, ensure no other background app has locked the camera. You can toggle between front and back cameras via the dropdown."
      ],
      [
        "Student QR code not scanning?",
        "Request the student increase their smartphone screen brightness to maximum. Clean any smudges on the screen. If issues persist, the lecturer can type the student's index number directly into the manual check-in bar in the scanner."
      ],
      [
        "Can students scan from their hostel or off-campus?",
        "No. Dynamic projector session QR codes rotate continuously. Furthermore, when geofencing is enabled on the session, any attempt to check in beyond the lecture venue radius is blocked with a location mismatch notice."
      ],
      [
        "What happens if there is no internet in the lecture hall?",
        "The webapp is an offline-capable PWA. The scanner records and queues scans in browser storage (IndexedDB). Once the lecturer connects to campus Wi-Fi or cellular data, all queued records synchronize automatically."
      ],
      [
        "How do students receive push notifications on phone?",
        "The student must sign in on their smartphone browser (Chrome, Edge, Safari, Firefox), click 'Enable Notifications' on the portal banner, and tap 'Allow'. The device will receive alerts even when the browser is minimized or the screen is locked."
      ],
      [
        "Student forgot their portal password?",
        "The student visits /student, selects the 'Reset Password' tab, enters their index number and registered email, and immediately chooses a new password without requiring administrator intervention."
      ],
      [
        "Can a student share their account with multiple phones?",
        "The application features Device Registration tracking under Settings. Unusual multi-device activity triggers verification safeguards to prevent credential sharing."
      ],
      [
        "How is the Continuous Assessment (CA) grade computed?",
        "Calculated as (Total Sessions Attended / Total Conducted Sessions) * 10, rounded to one decimal place. If a student falls below 75% total attendance, they are marked as 'Disqualified from Examination'."
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Final Callout Box
  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, finalY, contentWidth, 24, 2, 2, "F");
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, finalY, contentWidth, 24, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("Official Academic Support & Departmental Enquiries", margin + 4, finalY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(
    "For technical support, bulk student roster imports, department onboarding, or feature enhancements, " +
    "contact the Academic Computing & Quality Assurance Directorate, Kwame Nkrumah University of Science and Technology. " +
    "Access the live system at your institution's assigned domain.",
    margin + 4,
    finalY + 12,
    { maxWidth: contentWidth - 8 }
  );

  // Add Page Numbers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // On page 1 we already have custom cover styling, add standard footer on bottom
    drawFooter(i, totalPages);
  }

  // Save to public/app-manual.pdf
  const outputPath = path.resolve("public/app-manual.pdf");
  const pdfOutput = doc.output("arraybuffer");
  fs.writeFileSync(outputPath, Buffer.from(pdfOutput));
  console.log(`Generated official PDF manual at: ${outputPath} (${pdfOutput.byteLength} bytes, ${totalPages} pages)`);
}

generateManualPdf().catch(console.error);
