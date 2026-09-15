import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheet = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `KNUST Attendance Report - ${filename}`,
    Subject: "Academic Attendance & Assessment Compilation",
    Author: "Kwame Nkrumah University of Science and Technology",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const header = `# KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY (KNUST)\n# KNUST-ATTENDANCE-APP REPORT: ${filename}\n# Generated: ${new Date().toISOString()}\n`;
  const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export async function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const doc = new jsPDF();

  // Embed official KNUST crest logo in header
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = "/favicon.png";
    });
    doc.addImage(img, "PNG", 14, 8, 18, 18);
  } catch {
    // Non-blocking fallback if image cannot load
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 85, 43); // Official KNUST Green
  doc.text("KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY", 36, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("KNUST-ATTENDANCE-APP — " + title, 36, 20);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Official Academic Record · Generated: ${new Date().toLocaleString()}`, 36, 25);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 85, 43], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `KNUST-ATTENDANCE-APP · Kumasi, Ghana · Page ${data.pageNumber} of ${pageCount}`,
        14,
        doc.internal.pageSize.height - 8,
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}
