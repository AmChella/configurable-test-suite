import express, { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { logger } from "./helpers/logger";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import cors from "cors";
import fs from "fs";
import os from "os";
import { connectMongo, getCollection } from "./helpers/mongo";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", true);
app.use(cors({ origin: true, credentials: true }));
app.options("*", cors());

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Swagger UI
const openapiPath = path.resolve(process.cwd(), "api/openapi.yaml");
const swaggerDoc = YAML.load(openapiPath);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Helpers to avoid leaking server paths or secrets in responses
const WORKDIR = process.cwd();
const HOMEDIR = os.homedir();
const SENSITIVE_ENV_KEYS = [
  "TOKEN",
  "PASSWORD",
  "PASS",
  "SECRET",
  "API_KEY",
  "APIKEY",
  "ACCESS_TOKEN",
  "AUTH",
  "BEARER",
  "CLIENT_SECRET",
  "PRIVATE_KEY",
  "KEY",
  "COOKIE",
  "SESSION",
  "JWT",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeString(input: string): string {
  if (!input) return input;
  let out = input;
  try {
    if (WORKDIR) out = out.replace(new RegExp(escapeRegExp(WORKDIR), "g"), "<WORKDIR>");
    if (HOMEDIR) out = out.replace(new RegExp(escapeRegExp(HOMEDIR), "g"), "<HOME>");
    for (const key of SENSITIVE_ENV_KEYS) {
      const val = process.env[key];
      if (val && val.length > 3) {
        out = out.replace(new RegExp(escapeRegExp(val), "g"), `<${key}>`);
      }
    }
  } catch {
    // best-effort; ignore sanitize errors
  }
  return out;
}

function sanitizeJSON(value: any): any {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeJSON);
  if (typeof value === "object") {
    const out: any = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeJSON(v);
    }
    return out;
  }
  return value;
}

type RunRequest = {
  env?: string;
  grep?: string;
  headless?: boolean;
  scenarios?: any | any[]; // JSON test config(s) to execute
};

app.post("/run-test", async (req: Request, res: Response) => {
  const body: RunRequest = req.body || {};
  const envFile = body.env || process.env.ENV || "dev";
  const headless = body.headless === undefined ? true : !!body.headless;
  const grep = body.grep;
  const runStart = Date.now();
  const runId = `run-${runStart}`;

  const env = { ...process.env, ENV: envFile, HEADLESS: headless ? "true" : "false", RUN_ID: runId } as Record<string, string>;
  if (body.scenarios) {
    try {
      env.SCENARIOS_JSON = JSON.stringify(body.scenarios);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid scenarios JSON" });
    }
  }
  const args = ["playwright", "test"];
  if (grep) {
    args.push("--grep", grep);
  }
  const cwd = process.cwd();
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  logger.info(`Running command: ${cmd} ${args.join(" ")}`, "api");
  const child = spawn(cmd, args, { cwd, env });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d.toString()));
  child.stderr.on("data", (d) => (stderr += d.toString()));

  child.on("close", async (code) => {
    if (code === 0) {
      try {
        // Try Mongo first
        const db = await connectMongo();
        if (db) {
          const col = getCollection("reports");
          const docs = await col!.find({ runId }).toArray();
          const sanitizedReports = sanitizeJSON(docs);
          // Best-effort HTTP context from test-results
          const httpContext = collectHttpContext(runStart);
          return res.status(200).json({ ok: true, code, runId, reports: sanitizedReports, http: httpContext });
        }
        const jsonDir = path.resolve(process.cwd(), "reports/json");
        if (!fs.existsSync(jsonDir)) {
          return res.status(200).json({ ok: true, code, runId, reports: [], http: [], note: "No JSON reports found" });
        }
        const files = fs
          .readdirSync(jsonDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.join(jsonDir, f));
        // Filter files modified during/after this run
        const recentFiles = files.filter((fp) => {
          try {
            const st = fs.statSync(fp);
            return st.mtimeMs >= runStart - 1000; // 1s margin
          } catch {
            return false;
          }
        });
        const reports: any[] = [];
        for (const fp of recentFiles) {
          try {
            const content = fs.readFileSync(fp, "utf-8");
            reports.push(JSON.parse(content));
          } catch (e) {
            logger.warn(`Failed to parse report file ${fp}`, "api");
          }
        }
        const sanitizedReports = reports.map((r) => sanitizeJSON(r));
        // Best-effort: gather HTTP-like context from Playwright test-results attachments
        const httpContext = collectHttpContext(runStart);
        return res.status(200).json({ ok: true, code, runId, reports: sanitizedReports, http: httpContext });
      } catch (e: any) {
        logger.error(`Reading JSON reports failed: ${e.message}`, "api");
        return res.status(200).json({ ok: false, code, runId, stdout: sanitizeString(stdout), stderr: sanitizeString(stderr), note: "Reading JSON reports failed" });
      }
    }
    // non-zero exit code: if JSON reports/HTTP context exist, return them; otherwise fallback to CLI output
    try {
      // Try Mongo first
      const db = await connectMongo();
      if (db) {
        const col = getCollection("reports");
        const docs = await col!.find({ runId }).toArray();
        const sanitizedReports = sanitizeJSON(docs);
        const httpContext = collectHttpContext(runStart);
        if ((sanitizedReports && sanitizedReports.length) || (httpContext && httpContext.length)) {
          return res.status(200).json({ ok: false, code, runId, reports: sanitizedReports, http: httpContext });
        }
      }
      const jsonDir = path.resolve(process.cwd(), "reports/json");
      let reports: any[] = [];
      if (fs.existsSync(jsonDir)) {
        const files = fs
          .readdirSync(jsonDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.join(jsonDir, f));
        const recentFiles = files.filter((fp) => {
          try {
            const st = fs.statSync(fp);
            return st.mtimeMs >= runStart - 1000;
          } catch {
            return false;
          }
        });
        reports = recentFiles.map((fp) => {
          try {
            return JSON.parse(fs.readFileSync(fp, "utf-8"));
          } catch {
            return undefined as any;
          }
        }).filter(Boolean);
      }

      // Collect HTTP-like context from Playwright test-results attachments
      const httpContext = collectHttpContext(runStart);

      const sanitizedReports = reports.map((r) => sanitizeJSON(r));
      if ((sanitizedReports && sanitizedReports.length) || (httpContext && httpContext.length)) {
        return res.status(200).json({ ok: false, code, runId, reports: sanitizedReports, http: httpContext });
      }
    } catch (e: any) {
      logger.warn(`Failed to assemble failure reports: ${e?.message || e}`, "api");
    }
    return res.status(200).json({ ok: false, code, runId, stdout: sanitizeString(stdout), stderr: sanitizeString(stderr) });
  });
});

// Helper to collect http-like context while sanitizing content
function collectHttpContext(runStart: number) {
  const httpContext: any[] = [];
  const resultsDir = path.resolve(process.cwd(), "test-results");
  const MAX_TEXT_BYTES = 256 * 1024; // 256KB safety cap
  if (fs.existsSync(resultsDir)) {
    const entries = fs.readdirSync(resultsDir).map((n) => path.join(resultsDir, n));
    for (const entry of entries) {
      try {
        const st = fs.statSync(entry);
        if (!st.isDirectory()) continue;
        if (st.mtimeMs < runStart - 1000) continue;
        const filesIn = fs.readdirSync(entry).map((n) => path.join(entry, n));
        const texts = filesIn.filter((p) => /\.(md|txt)$/i.test(p));
        const traces = filesIn.filter((p) => /trace\.zip$/i.test(p));
        const textContents = texts
          .map((p) => {
            try {
              const buf = fs.readFileSync(p);
              const size = buf.byteLength;
              const contentRaw = buf.slice(0, Math.min(size, MAX_TEXT_BYTES)).toString("utf-8");
              const content = sanitizeString(contentRaw);
              return { file: path.basename(p), size, content };
            } catch {
              return undefined as any;
            }
          })
          .filter(Boolean);
        const traceFiles = traces.map((p) => ({ file: path.basename(p), size: (fs.statSync(p).size || 0) }));
        if (textContents.length || traceFiles.length) {
          httpContext.push({ testFolder: path.basename(entry), attachments: { texts: textContents, traces: traceFiles } });
        }
      } catch {}
    }
  }
  return httpContext;
}

// Sample UI for interactive testing
app.use("/sample", express.static(path.resolve(process.cwd(), "sample")));

app.get("/sample-ui", (req, res) => {
  res.sendFile(path.resolve(process.cwd(), "sample", "editor.html"));
});

// Query API for reports
app.get("/reports", async (req: Request, res: Response) => {
  try {
    const { title, status, from, to, limit, runId } = req.query as Record<string, string | undefined>;
    const db = await connectMongo();
    if (!db) return res.status(503).json({ ok: false, error: "Reports DB unavailable" });
    const col = getCollection("reports");
    const query: any = {};
    if (runId) query.runId = runId;
    if (title) query.title = { $regex: title, $options: "i" };
    if (status) query.status = status;
    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = Number(from);
      if (to) query.startTime.$lte = Number(to);
    }
    const lim = Math.min(Number(limit || 50), 200);
    const docs = await col!.find(query).sort({ startTime: -1 }).limit(lim).toArray();
    const sanitized = sanitizeJSON(docs);
    const summary = (sanitized as any[]).reduce(
      (acc, d: any) => {
        const s = d?.status || "unknown";
        acc.total++;
        acc.byStatus[s] = (acc.byStatus[s] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<string, number> }
    );
    return res.json({ ok: true, count: sanitized.length, summary, reports: sanitized });
  } catch (e: any) {
    logger.error(`GET /reports failed: ${e?.message || e}`, "api");
    return res.status(500).json({ ok: false, error: "Failed to fetch reports" });
  }
});

// Retrieve reports for a specific runId
app.get("/reports/:runId", async (req: Request, res: Response) => {
  try {
    const { runId } = req.params as { runId: string };
    const db = await connectMongo();
    if (!db) return res.status(503).json({ ok: false, error: "Reports DB unavailable" });
    const col = getCollection("reports");
    const docs = await col!.find({ runId }).sort({ startTime: 1 }).toArray();
    const sanitized = sanitizeJSON(docs);
    const summary = (sanitized as any[]).reduce(
      (acc, d: any) => {
        const s = d?.status || "unknown";
        acc.total++;
        acc.byStatus[s] = (acc.byStatus[s] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<string, number> }
    );
    return res.json({ ok: true, runId, count: sanitized.length, summary, reports: sanitized });
  } catch (e: any) {
    logger.error(`GET /reports/:runId failed: ${e?.message || e}`, "api");
    return res.status(500).json({ ok: false, error: "Failed to fetch run reports" });
  }
});

const port = 4001;
app.listen(port, "0.0.0.0", () => {
  logger.info(`Test runner API listening on http://localhost:${port}`, "api");
});

export default app;
