import fs from "fs";
import path from "path";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_DIR = path.resolve(__dirname, "../logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Single rolling file per day
function currentLogFile() {
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return path.join(LOG_DIR, `run-${stamp}.log`);
}

function ts() {
  const d = new Date();
  return d.toISOString();
}

function write(line: string) {
  try {
    fs.appendFileSync(currentLogFile(), line + "\n", { encoding: "utf-8" });
  } catch {
    // best-effort; ignore file errors
  }
}

function format(level: LogLevel, message: any, scope?: string) {
  const text = typeof message === "string" ? message : JSON.stringify(message);
  const prefix = scope ? `[${scope}]` : "";
  return `${ts()} ${level.toUpperCase()} ${prefix} ${text}`.trim();
}

export const logger = {
  debug(msg: any, scope?: string) {
    const line = format("debug", msg, scope);
    // Keep debug out of stdout by default; use console.debug
    // eslint-disable-next-line no-console
    console.debug(line);
    write(line);
  },
  info(msg: any, scope?: string) {
    const line = format("info", msg, scope);
    // eslint-disable-next-line no-console
    console.log(line);
    write(line);
  },
  warn(msg: any, scope?: string) {
    const line = format("warn", msg, scope);
    // eslint-disable-next-line no-console
    console.warn(line);
    write(line);
  },
  error(msg: any, scope?: string) {
    const line = format("error", msg, scope);
    // eslint-disable-next-line no-console
    console.error(line);
    write(line);
  },
  child(scope: string) {
    return {
      debug: (msg: any) => this.debug(msg, scope),
      info: (msg: any) => this.info(msg, scope),
      warn: (msg: any) => this.warn(msg, scope),
      error: (msg: any) => this.error(msg, scope),
    };
  },
};

export default logger;
