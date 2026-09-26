import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "motion/react";
import {
  Eye,
  EyeOff,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  QrCode as QrIcon,
} from "lucide-react";
import { QmarkLogo } from "./QmarkLogo";
import { toast } from "sonner";

export interface StudentPassData {
  indexNumber: string;
  fullName: string;
  department?: string;
  level?: string | number;
  attendanceRate?: number;
  token?: string;
  qrPayload?: string;
  qrDataUrl?: string;
}

interface StudentQrPassCardProps {
  student: StudentPassData;
  className?: string;
}

export const StudentQrPassCard: React.FC<StudentQrPassCardProps> = ({
  student,
  className = "",
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>(() => student.qrDataUrl || "");
  const [isRevealed, setIsRevealed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // If student already has a valid data URL, use it directly
  useEffect(() => {
    if (student.qrDataUrl) {
      setQrDataUrl(student.qrDataUrl);
      return;
    }

    if (student.token && student.token.startsWith("data:image/")) {
      setQrDataUrl(student.token);
      return;
    }

    // Determine the compact payload to encode (do not encode massive base64 strings!)
    const passPayload =
      student.qrPayload ||
      (student.token && !student.token.startsWith("data:") ? student.token : null) ||
      student.indexNumber;

    let active = true;
    QRCode.toDataURL(passPayload, {
      width: 320,
      margin: 1,
      color: {
        dark: "#0A1F44",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("QR Pass generation error:", err);
        // Fallback to minimal index number
        QRCode.toDataURL(student.indexNumber, { width: 320, margin: 1 })
          .then((url) => {
            if (active) setQrDataUrl(url);
          })
          .catch(() => {});
      });

    return () => {
      active = false;
    };
  }, [student.qrDataUrl, student.token, student.qrPayload, student.indexNumber]);

  const copyIndex = () => {
    navigator.clipboard.writeText(student.indexNumber);
    setCopied(true);
    toast.success("Index number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPass = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qmark-pass-${student.indexNumber}.png`;
    a.click();
    toast.success("QR Pass image downloaded");
  };

  const printPass = () => {
    window.print();
  };

  return (
    <>
      <div
        className={`relative w-full max-w-[390px] mx-auto rounded-3xl overflow-hidden select-none transition-all ${className}`}
        style={{
          background: "linear-gradient(135deg, #0F2A5C 0%, #0A1F44 60%, #071630 100%)",
          border: "1px solid rgba(212, 175, 55, 0.25)",
          boxShadow: "0 12px 40px rgba(10, 31, 68, 0.35)",
        }}
      >
        <div className="p-6 text-white relative">
          {/* Top Bar with Logo & Eye Reveal Toggle */}
          <div className="flex items-center justify-between pb-3">
            <QmarkLogo size="sm" variant="full" theme="dark" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRevealed(!isRevealed)}
                className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.15)",
                  color: "#D4AF37",
                  border: "1px solid rgba(212, 175, 55, 0.3)",
                }}
                title={isRevealed ? "Hide QR Pass for privacy" : "Reveal QR Pass"}
                aria-label="Toggle QR visibility"
              >
                {isRevealed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>

          {/* Student Identity */}
          <div className="mt-4 text-center">
            <div
              className="text-[11px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "#D4AF37" }}
            >
              STUDENT DIGITAL PASS
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1 truncate">
              {student.fullName || "Student Name"}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <button
                type="button"
                onClick={copyIndex}
                className="text-xs font-mono text-white/70 hover:text-white flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-full cursor-pointer transition-colors"
                title="Click to copy Index"
              >
                <span>Index: {student.indexNumber}</span>
                {copied ? <Check className="size-3 text-[#D4AF37]" /> : <Copy className="size-3 text-white/60" />}
              </button>
              {student.level && (
                <span className="text-xs text-white/60">• Level {student.level}</span>
              )}
            </div>
            {student.department && (
              <p className="text-[11px] text-white/50 truncate mt-1">{student.department}</p>
            )}
          </div>

          {/* QR Code Card Frame with corner markers */}
          <div
            className="relative mt-5 p-4 rounded-2xl bg-white text-[#0A1F44] flex flex-col items-center justify-center cursor-pointer group shadow-lg"
            style={{ border: "2px solid #D4AF37" }}
            onClick={() => setIsExpanded(true)}
            title="Tap to view full screen"
          >
            {/* Corner Bracket accents */}
            <div
              className="absolute top-2 left-2 size-3.5 border-t-2 border-l-2 rounded-tl-sm pointer-events-none"
              style={{ borderColor: "#0A1F44" }}
            />
            <div
              className="absolute top-2 right-2 size-3.5 border-t-2 border-r-2 rounded-tr-sm pointer-events-none"
              style={{ borderColor: "#0A1F44" }}
            />
            <div
              className="absolute bottom-10 left-2 size-3.5 border-b-2 border-l-2 rounded-bl-sm pointer-events-none"
              style={{ borderColor: "#0A1F44" }}
            />
            <div
              className="absolute bottom-10 right-2 size-3.5 border-b-2 border-r-2 rounded-br-sm pointer-events-none"
              style={{ borderColor: "#0A1F44" }}
            />

            {/* QR Plate or Privacy Placeholder */}
            {isRevealed ? (
              qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Student Attendance Pass QR"
                  className="size-48 sm:size-52 object-contain"
                />
              ) : (
                <div className="size-48 flex items-center justify-center text-xs text-neutral-400">
                  Generating pass...
                </div>
              )
            ) : (
              <div className="size-48 flex flex-col items-center justify-center gap-2 text-center p-4">
                <div
                  className="size-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(10, 31, 68, 0.08)", color: "#0A1F44" }}
                >
                  <EyeOff className="size-6" />
                </div>
                <span className="text-xs font-bold text-[#0A1F44]">Pass Hidden</span>
                <span className="text-[11px] text-neutral-500">Tap eye button above to reveal</span>
              </div>
            )}

            {/* QR Bottom Meta */}
            <div className="mt-3 pt-2 w-full border-t border-neutral-100 flex items-center justify-between text-[10px] font-bold tracking-wider px-1">
              <span style={{ color: "#D4AF37" }}>● ACTIVE PASS</span>
              <span className="text-neutral-500">VALID • TODAY</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={downloadPass}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-transform active:scale-95 cursor-pointer"
              style={{
                backgroundColor: "#D4AF37",
                color: "#0A1F44",
              }}
            >
              <Download className="size-3.5" />
              <span>Download QR</span>
            </button>

            <button
              type="button"
              onClick={printPass}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-transform active:scale-95 cursor-pointer border"
              style={{
                borderColor: "#D4AF37",
                color: "#D4AF37",
                backgroundColor: "transparent",
              }}
            >
              <Printer className="size-3.5" />
              <span>Print Card</span>
            </button>
          </div>

          {/* Brightness note */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/60">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: "#D4AF37", boxShadow: "0 0 6px #D4AF37" }}
            />
            <span>Turn screen brightness up for fastest scan results</span>
          </div>
        </div>
      </div>

      {/* Full-Screen High-Contrast Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061631]/95 backdrop-blur-md"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-[#0A1F44] flex flex-col items-center shadow-2xl border"
              style={{ borderColor: "#D4AF37" }}
            >
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[#0A1F44] cursor-pointer"
                aria-label="Close"
              >
                <Minimize2 className="size-5" />
              </button>

              <QmarkLogo size="sm" variant="full" />

              <div className="mt-4 text-center">
                <h3 className="text-xl font-bold text-[#0A1F44]">{student.fullName}</h3>
                <p className="font-mono text-sm mt-0.5 font-bold" style={{ color: "#D4AF37" }}>
                  {student.indexNumber}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Hold this screen up to the classroom scanner
                </p>
              </div>

              <div className="mt-5 p-3 rounded-2xl bg-white border-2 border-[#0A1F44] shadow-md">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Full Student Pass QR"
                    className="size-64 sm:size-72 object-contain"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="mt-6 w-full py-3 rounded-full text-white font-bold text-sm transition-all cursor-pointer"
                style={{ backgroundColor: "#0A1F44" }}
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
