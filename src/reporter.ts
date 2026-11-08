import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { writeFileSync } from "node:fs";

type Attachment = TestResult["attachments"][number];

class ScreenshotReporter implements Reporter {
  private pngAttachments: Attachment[] = [];

  onBegin(_config: FullConfig, suite: Suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase, _result: TestResult) {
    console.log(`Starting test ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.pngAttachments.push(...result.attachments.filter((a) => a.contentType === "image/png"));
    console.log(`Finished test ${test.title}: ${result.status}`);
  }

  onEnd(result: FullResult) {
    console.log("images are: ", this.pngAttachments);
    console.log(`Finished the run: ${result.status}`);
    // TODO: use output path from config
    writeFileSync(
      "screenshot-report.html",
      `
      <!doctype html>
        <html><body><p>Hello world</p></body></html>
`,
      { encoding: "utf8" },
    );
  }
}

export default ScreenshotReporter;
