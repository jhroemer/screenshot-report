import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from "@playwright/test/reporter";
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

type Attachment = TestResult["attachments"][number];

type Base64Png = string & { readonly __brand: "Base64Png" };

type ScreenshotComparison =
  | {
      kind: "mismatch";
      name: string;
      expected: Base64Png;
      actual: Base64Png;
      diff: Base64Png;
    }
  | {
      kind: "missing";
      name: string;
      actual: Base64Png;
    }
  | {
      kind: "unstable";
      name: string;
      previous: Base64Png;
      actual: Base64Png;
      diff: Base64Png;
      expected: Base64Png | null;
    }
  | {
      kind: "unrecognized";
      name: string;
      attachmentNames: string[];
    };

type Attempt = {
  retry: number;
  status: TestResult["status"];
  comparisons: ScreenshotComparison[];
};

type TestEntry = {
  id: string;
  titlePath: string[];
  projectName: string;
  relativeFile: string;
  line: number;
  outcome: ReturnType<TestCase["outcome"]>;
  attempts: Attempt[];
};

type Report = {
  status: FullResult["status"];
  startTime: string;
  durationMs: number;
  tests: TestEntry[];
};

type AttachmentGroup = { paths: Map<string, string>; attachmentNames: string[] };

const COMPARISON_ATTACHMENT_NAME =
  /^(?<base>.+)-(?<role>expected|actual|diff|previous)(?<extension>\.png)$/;

const BASE64_PNG_SIGNATURE = "iVBORw0KGgo";

function isBase64Png(value: string): value is Base64Png {
  return value.startsWith(BASE64_PNG_SIGNATURE);
}

function encodePng(path: string | undefined): Base64Png | null {
  if (!path) return null;
  try {
    const base64 = readFileSync(path).toString("base64");
    return isBase64Png(base64) ? base64 : null;
  } catch {
    return null;
  }
}

function parseScreenshotComparisons(attachments: Attachment[]): ScreenshotComparison[] {
  const groups = new Map<string, AttachmentGroup>();
  for (const attachment of attachments) {
    const match = COMPARISON_ATTACHMENT_NAME.exec(attachment.name);
    if (attachment.contentType !== "image/png" || !attachment.path || !match?.groups) continue;
    // "login-actual.png" -> base: "login", role: "actual", extension: ".png"
    const { base, role, extension } = match.groups;
    const name = `${base}${extension}`;
    const group = groups.get(name) ?? {
      paths: new Map<string, string>(),
      attachmentNames: new Array<string>(),
    };
    group.paths.set(role, attachment.path);
    group.attachmentNames.push(attachment.name);
    groups.set(name, group);
  }
  return [...groups].map(([name, group]) => toScreenshotComparison(name, group));
}

function toScreenshotComparison(
  name: string,
  { paths, attachmentNames }: AttachmentGroup,
): ScreenshotComparison {
  const expected = encodePng(paths.get("expected"));
  const actual = encodePng(paths.get("actual"));
  const diff = encodePng(paths.get("diff"));
  const previous = encodePng(paths.get("previous"));
  if (previous && actual && diff) {
    return { kind: "unstable", name, previous, actual, diff, expected };
  }
  if (expected && actual && diff) {
    return { kind: "mismatch", name, expected, actual, diff };
  }
  // With the default `updateSnapshots: "missing"`, `expected` is attached too, identical to `actual`.
  if (actual && !paths.has("diff")) {
    return { kind: "missing", name, actual };
  }
  return { kind: "unrecognized", name, attachmentNames };
}

function renderReport(report: Report): void {
  document.body.append(
    Object.assign(document.createElement("h1"), { textContent: "Screenshot report" }),
  );
  for (const test of report.tests) {
    const section = document.createElement("section");
    section.append(
      Object.assign(document.createElement("h2"), {
        textContent: test.titlePath.filter(Boolean).join(" › "),
      }),
    );
    for (const attempt of test.attempts) {
      section.append(
        Object.assign(document.createElement("h3"), {
          textContent: `Attempt ${attempt.retry + 1}: ${attempt.status}`,
        }),
      );
      for (const comparison of attempt.comparisons) {
        section.append(
          Object.assign(document.createElement("h4"), {
            textContent: `${comparison.name} (${comparison.kind})`,
          }),
        );
        let images: [label: string, png: Base64Png][];
        switch (comparison.kind) {
          case "mismatch":
            images = [
              ["expected", comparison.expected],
              ["actual", comparison.actual],
              ["diff", comparison.diff],
            ];
            break;
          case "missing":
            images = [["actual", comparison.actual]];
            break;
          case "unstable":
            images = [
              ["previous", comparison.previous],
              ["actual", comparison.actual],
              ["diff", comparison.diff],
            ];
            if (comparison.expected) images.unshift(["expected", comparison.expected]);
            break;
          case "unrecognized":
            images = [];
            section.append(
              Object.assign(document.createElement("p"), {
                textContent: `Unrecognized attachments: ${comparison.attachmentNames.join(", ")}`,
              }),
            );
            break;
          default:
            images = comparison satisfies never;
        }
        const figures = Object.assign(document.createElement("div"), { className: "figures" });
        for (const [label, png] of images) {
          const figure = document.createElement("figure");
          figure.append(
            Object.assign(document.createElement("img"), {
              alt: `${comparison.name} ${label}`,
              src: `data:image/png;base64,${png}`,
            }),
            Object.assign(document.createElement("figcaption"), { textContent: label }),
          );
          figures.append(figure);
        }
        section.append(figures);
      }
    }
    document.body.append(section);
  }
}

function renderHtml(report: Report): string {
  const reportJson = JSON.stringify(report).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Screenshot report</title>
<style>
.figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
figure { margin: 0; }
img { display: block; width: 100%; height: auto; border: 1px solid #ccc; }
</style>
</head>
<body>
<script type="application/json" id="report">${reportJson}</script>
<script type="module">
${renderReport.toString()}
const report = JSON.parse(document.getElementById("report").textContent);
renderReport(report);
</script>
</body>
</html>
`;
}

class ScreenshotReporter implements Reporter {
  private rootDir = "";
  private tests = new Map<string, { test: TestCase; attempts: Attempt[] }>();

  onBegin(config: FullConfig, suite: Suite) {
    this.rootDir = config.rootDir;
    for (const test of suite.allTests()) {
      this.tests.set(test.id, { test, attempts: [] });
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.tests.get(test.id)?.attempts.push({
      retry: result.retry,
      status: result.status,
      comparisons: parseScreenshotComparisons(result.attachments),
    });
  }

  onError(error: TestError) {
    console.error(error.message ?? error.value);
  }

  onEnd(result: FullResult) {
    const report: Report = {
      status: result.status,
      startTime: result.startTime.toISOString(),
      durationMs: result.duration,
      tests: [...this.tests.values()].map(({ test, attempts }) => ({
        id: test.id,
        titlePath: test.titlePath(),
        projectName: test.parent.project()?.name ?? "",
        relativeFile: relative(this.rootDir, test.location.file),
        line: test.location.line,
        outcome: test.outcome(),
        attempts,
      })),
    };
    // TODO: use output path from config
    writeFileSync("screenshot-report.html", renderHtml(report), { encoding: "utf8" });
  }
}

export default ScreenshotReporter;
