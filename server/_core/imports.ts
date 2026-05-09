import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { sdk } from "./sdk";

/**
 * Column order matches the offline patient-intake spreadsheet — required
 * by the offline-import workflow so the same sheet that's filled in by
 * hand at reception can be uploaded back when connectivity returns.
 */
export const INTAKE_COLUMNS = [
  "Date",
  "Patient Name",
  "Father Name",
  "Age",
  "Gender",
  "Phone",
  "Area",
  "Complaint",
  "Diagnosis",
  "Medicine Given",
  "Bottle Size (ml)",
  "Dosage",
] as const;

export function registerImportRoutes(app: Express) {
  // Auth-checked download of the blank intake template
  app.get("/api/templates/patient-intake.xlsx", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Sign in required" });
        return;
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = "Outreach Health CRM";
      wb.created = new Date();
      const ws = wb.addWorksheet("Daily Entry");

      ws.columns = INTAKE_COLUMNS.map((header) => ({
        header,
        key: header,
        width: header.length < 14 ? 14 : header.length + 4,
      }));

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: "middle", horizontal: "left" };
      headerRow.height = 22;

      // Add 30 blank rows as filling guidance
      for (let i = 0; i < 30; i++) {
        ws.addRow({});
      }

      // Freeze header
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="patient-intake-template.xlsx"`
      );
      res.status(200).send(Buffer.from(buffer));
    } catch (err) {
      console.error("[imports] template download failed", err);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });
}
