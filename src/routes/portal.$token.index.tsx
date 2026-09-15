import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { firestoreDb } from "@/integrations/firebase/config";
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, GraduationCap, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "@/components/PublicFooter";
import { KnustEmblem } from "@/components/KnustEmblem";

export const Route = createFileRoute("/portal/$token/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Student QR Portal — KNUST-ATTENDANCE-APP" }] }),
  component: PortalPage,
});

type Student = {
  full_name: string;
  index_number: string;
  level: string;
  department: string;
  qr_uuid: string;
  pin: string;
};

function PortalPage() {
  const { token } = Route.useParams();
  const [index, setIndex] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Verify active portal token
      const portalSnap = await getDocs(
        query(
          collection(firestoreDb, "student_portal_links"),
          where("token", "==", token),
          where("is_active", "==", true),
        ),
      );
      if (portalSnap.empty) {
        toast.error("Invalid or expired portal link.");
        return;
      }
      const portalData = portalSnap.docs[0].data() as any;
      const portalOwnerId = portalData.owner_id;

      // 2. Find student (scoped to portal owner so other accounts' students are invisible)
      const cleanIndex = index.trim().toUpperCase();
      const cleanEmail = email.trim().toLowerCase();
      const studQuery = portalOwnerId
        ? query(
            collection(firestoreDb, "students"),
            where("owner_id", "==", portalOwnerId),
            where("index_number", "==", cleanIndex),
          )
        : query(collection(firestoreDb, "students"), where("index_number", "==", cleanIndex));
      const studSnap = await getDocs(studQuery);

      if (studSnap.empty) {
        toast.error("No match. Check your index number and email.");
        return;
      }

      const studDoc = studSnap.docs[0];
      const sData = studDoc.data() as any;

      if (sData.email && cleanEmail && sData.email.toLowerCase() !== cleanEmail) {
        toast.error("Email does not match our records for this index number.");
        return;
      }

      let qrUuid = sData.qr_uuid;
      if (!qrUuid) {
        qrUuid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 18);
        await updateDoc(doc(firestoreDb, "students", studDoc.id), { qr_uuid: qrUuid });
      }

      let deptName = sData.program || "General";
      if (sData.department_id) {
        const deptDoc = await getDoc(doc(firestoreDb, "departments", sData.department_id));
        if (deptDoc.exists()) deptName = (deptDoc.data() as any).name || deptName;
      }

      const row: Student = {
        full_name: sData.full_name || "",
        index_number: sData.index_number || cleanIndex,
        level: sData.level ? String(sData.level) : "100",
        department: deptName,
        qr_uuid: qrUuid,
        pin: sData.pin || "",
      };

      setStudent(row);
      const url = await QRCode.toDataURL(row.qr_uuid, {
        width: 360,
        margin: 2,
        color: { dark: "#00552b", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch (err: any) {
      toast.error(err?.message || "Failed to retrieve QR");
    } finally {
      setLoading(false);
    }
  };

  const downloadPng = () => {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${student!.index_number}-qr.png`;
    a.click();
  };

  const downloadPdf = async () => {
    const doc = new jsPDF();

    // Embed KNUST Logo
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = "/favicon.png";
      });
      doc.addImage(img, "PNG", 92, 12, 26, 26);
    } catch {
      // Non-blocking
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 85, 43);
    doc.text("KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY", 105, 44, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text("KNUST Attendance — Universal Student QR Pass", 105, 52, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(student!.full_name, 105, 66, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 85, 43);
    doc.text(`Index: ${student!.index_number}`, 105, 74, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Level ${student!.level} · ${student!.department}`, 105, 82, { align: "center" });

    doc.addImage(qrDataUrl, "PNG", 65, 92, 80, 80);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Show this QR to your lecturer/T.A. or scan the classroom projector QR to check in.", 105, 182, {
      align: "center",
    });
    doc.text("This official QR works for every course and session — past, present and future.", 105, 190, {
      align: "center",
    });
    doc.save(`${student!.index_number}-qr.pdf`);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="flex-1 flex flex-col items-center p-6">
        <div className="flex items-center gap-3 mb-6 mt-4">
          <KnustEmblem size={36} />
          <h1 className="text-2xl font-bold">KNUST Student QR Portal</h1>
        </div>

        {!student ? (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Get your QR code</CardTitle>
              <CardDescription>
                Enter your index number and the email you registered with. Your QR works for every
                course you are enrolled in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={lookup} className="space-y-3">
                <div>
                  <Label>Index number</Label>
                  <Input value={index} onChange={(e) => setIndex(e.target.value)} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Looking up..." : "Show my QR"}
                </Button>
              </form>
              <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-center text-sm">
                <p className="text-muted-foreground mb-2">New student and not in the system yet?</p>
                <Link to="/portal/$token/register" params={{ token }}>
                  <Button variant="outline" className="w-full">
                    <UserPlus className="size-4 mr-1" />
                    Register as a new student
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{student.full_name}</CardTitle>
              <CardDescription>
                {student.index_number} · Level {student.level} · {student.department}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img src={qrDataUrl} alt="QR Code" className="size-64" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={downloadPng} className="w-full">
                  <Download className="size-4 mr-1" /> Download PNG
                </Button>
                <Button variant="outline" onClick={downloadPdf} className="w-full">
                  <FileText className="size-4 mr-1" /> Download PDF
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStudent(null);
                  setIndex("");
                  setEmail("");
                }}
              >
                Look up another index
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
