import path from "node:path";
import { copyFile, ensureDir, exists, listFilesRecursive } from "../utils/fs.js";

export type InitOptions = {
  rootDir: string;
  templatesDir: string;
};

export function initGovernance(opts: InitOptions) {
  const govDst = path.join(opts.rootDir, "ai", "governance");
  const govSrc = path.join(opts.templatesDir, "governance");

  ensureDir(govDst);

  // Copy only if missing to avoid destructive overwrite
  for (const srcFile of listFilesRecursive(govSrc)) {
    const rel = path.relative(govSrc, srcFile);
    const dstFile = path.join(govDst, rel);
    if (!exists(dstFile)) {
      copyFile(srcFile, dstFile);
    }
  }

  return { governancePath: govDst };
}
