import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

function runTestProject(args: string[], env: Record<string, string> = {}) {
  return new Promise<number | null>((resolve) =>
    spawn("npx", ["playwright", "test", ...args], {
      cwd: "test-project",
      stdio: "inherit",
      env: { ...process.env, ...env },
    }).on("close", resolve),
  );
}

// Baselines are rendered right before the run that compares against them, so the
// resulting diff is deterministic and no test-project baselines need to be committed.
export default async function globalSetup() {
  rmSync("test-project/screenshot-report.html", { force: true });
  rmSync("test-project/tests/__screenshots__", { recursive: true, force: true });

  const baselineCode = await runTestProject(["--update-snapshots=all"], {
    FIXTURE_VARIANT: "baseline",
  });
  if (baselineCode !== 0) {
    throw new Error(`Expected test-project baseline run to pass, exited with ${baselineCode}`);
  }

  const code = await runTestProject([]);
  if (code !== 1) throw new Error(`Expected test-project to fail, exited with ${code}`);
}
