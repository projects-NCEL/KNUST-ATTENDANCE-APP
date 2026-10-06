import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Robust cross-browser and iframe-safe blob downloader
 */
function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup
    }
  }, 1000);
}

export function exportToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheet = "Attendance",
): boolean {
  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `Qmark Attendance Report - ${filename}`,
      Subject: "Academic Attendance & Assessment Compilation",
      Author: "Qmark Attendance Platform",
      CreatedDate: new Date(),
    };
    XLSX.utils.book_append_sheet(wb, ws, sheet);

    // Generate binary array buffer and trigger real browser blob download
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${filename}.xlsx`);
    return true;
  } catch (err) {
    console.error("exportToExcel error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to generate Excel file");
  }
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string): boolean {
  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    // Prepend UTF-8 BOM so Excel and text editors properly render symbols and index numbers
    const bom = "\uFEFF";
    const header = `# QMARK ATTENDANCE PLATFORM\n# REPORT: ${filename}\n# Generated: ${new Date().toLocaleString()}\n#\n`;
    const blob = new Blob([bom + header + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${filename}.csv`);
    return true;
  } catch (err) {
    console.error("exportToCSV error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to generate CSV file");
  }
}

export async function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: headers.length > 7 ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    // Embed standalone brand mark in header if available (quick non-blocking load)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const timer = setTimeout(() => reject(new Error("Image timeout")), 300);
        el.crossOrigin = "anonymous";
        el.onload = () => {
          clearTimeout(timer);
          resolve(el);
        };
        el.onerror = (err) => {
          clearTimeout(timer);
          reject(err);
        };
        el.src = "/qmark_icon_standalone.png";
      });
      doc.addImage(img, "PNG", 14, 8, 14, 14);
    } catch {
      // Non-blocking fallback if image cannot load
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(10, 31, 68); // Brand Deep Navy
    doc.text("QMARK ATTENDANCE PLATFORM", 32, 13);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(title, 32, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Official Academic Record · Generated: ${new Date().toLocaleString()}`, 32, 23);

    // Resolve autoTable function robustly across ESM / CJS module bundlers
    const runAutoTable =
      (typeof autoTable === "function" ? autoTable : (autoTable as any)?.default) ||
      (doc as any).autoTable;

    if (typeof runAutoTable === "function") {
      runAutoTable(doc, {
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [10, 31, 68], textColor: [212, 175, 55], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).internal?.getNumberOfPages?.() || 1;
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Qmark Attendance Platform · Page ${data.pageNumber} of ${pageCount}`,
            14,
            doc.internal.pageSize.height - 8,
          );
        },
      });
    } else if (typeof (doc as any).autoTable === "function") {
      (doc as any).autoTable({
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [10, 31, 68], textColor: [212, 175, 55], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }

    // Output as blob and download via safe DOM element link
    const pdfBlob = doc.output("blob");
    downloadBlob(pdfBlob, `${filename}.pdf`);
    return true;
  } catch (err) {
    console.error("exportToPDF error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to generate PDF document");
  }
}

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}
