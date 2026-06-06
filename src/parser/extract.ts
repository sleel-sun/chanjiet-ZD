import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DictionaryError } from "../shared/errors.js";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureExtracted(chmFile: string, extractDir: string): Promise<void> {
  if (await pathExists(extractDir)) return;
  if (!(await pathExists(chmFile))) {
    throw new DictionaryError("SOURCE_CHM_MISSING", "Source CHM file is missing", { chmFile });
  }

  await mkdir(dirname(extractDir), { recursive: true });
  await runExtractChmLib(chmFile, extractDir);
}

async function runExtractChmLib(chmFile: string, extractDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("extract_chmLib", [chmFile, extractDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(
        new DictionaryError("EXTRACT_TOOL_MISSING", "extract_chmLib is not available", {
          cause: error.message,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new DictionaryError("CHM_EXTRACT_FAILED", "Failed to extract CHM file", {
          chmFile,
          extractDir,
          exitCode: code,
          stderr,
        }),
      );
    });
  });
}
