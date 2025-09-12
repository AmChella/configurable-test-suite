import fs from "fs";
import path from "path";

type StepRecord = {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted" | "unknown";
  error?: string;
  startTime: number;
  endTime?: number;
};

type TestRecord = {
  title: string;
  location?: string;
  status: string;
  steps: StepRecord[];
  startTime: number;
  endTime?: number;
};

const REPORT_DIR = path.resolve(process.cwd(), "reports/json");

export default class JsonStepsReporter {
  private currentTest?: TestRecord;
  private filePath?: string;

  onBegin() {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  onTestBegin(test: any) {
    const started = Date.now();
    this.currentTest = {
      title: test.titlePath().join(" > "),
      location: test.location ? `${test.location.file}:${test.location.line}:${test.location.column}` : undefined,
      status: "running",
      steps: [],
      startTime: started,
    };
    const safe = test.titlePath().join("_").replace(/[^a-z0-9_\-]/gi, "_");
    this.filePath = path.join(REPORT_DIR, `${safe}-${started}.json`);
    this.flush();
  }

  onStepBegin(test: any, result: any, step: any) {
    if (!this.currentTest) return;
    this.currentTest.steps.push({
      title: step.title,
      status: "unknown",
      startTime: Date.now(),
    });
    this.flush();
  }

  onStepEnd(test: any, result: any, step: any) {
    if (!this.currentTest) return;
    const rec = this.currentTest.steps.find((s) => s.title === step.title && !s.endTime);
    if (rec) {
      rec.endTime = Date.now();
      const status = step.category === "test.step" ? step.error ? "failed" : "passed" : "passed";
      rec.status = status as StepRecord["status"];
      if (step.error) {
        rec.error = step.error.message || String(step.error);
      }
      this.flush();
    }
  }

  onTestEnd(test: any, result: any) {
    if (!this.currentTest) return;
    this.currentTest.status = result.status;
    this.currentTest.endTime = Date.now();
    this.flush();
  }

  private flush() {
    if (!this.filePath || !this.currentTest) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.currentTest, null, 2), "utf-8");
    } catch {
      // ignore
    }
  }
}

module.exports = JsonStepsReporter;
