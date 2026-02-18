import path from "node:path";
import { nowDate, renderTemplate } from "../utils/strings.js";
import { ensureDir, readFile, writeFile } from "../utils/fs.js";

export type ReportInput = {
  rootDir: string;
  templatesDir: string;
  action: string;
  prompt: string;
  what: string;
  why: string;
  how: string;
  result: string;
};

export function writeReport(input: ReportInput) {
  const date = nowDate();
  const base = path.join(input.rootDir, "reports", date, input.action);
  ensureDir(base);

  const promptTpl = readFile(path.join(input.templatesDir, "reports", "prompt.md"));
  const reportTpl = readFile(path.join(input.templatesDir, "reports", "report.md"));

  writeFile(path.join(base, "prompt.md"), renderTemplate(promptTpl, { prompt: input.prompt }));
  writeFile(
    path.join(base, "report.md"),
    renderTemplate(reportTpl, {
      what: input.what,
      why: input.why,
      how: input.how,
      result: input.result,
    }),
  );

  return { reportDir: base };
}
