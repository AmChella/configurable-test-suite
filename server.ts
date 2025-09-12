import express, { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { logger } from "./helpers/logger";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Swagger UI
const openapiPath = path.resolve(process.cwd(), "api/openapi.yaml");
const swaggerDoc = YAML.load(openapiPath);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

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

  const env = { ...process.env, ENV: envFile, HEADLESS: headless ? "true" : "false" } as Record<string, string>;
  if (body.scenarios) {
    try {
      env.SCENARIOS_JSON = JSON.stringify(body.scenarios);
    } catch {
      return res.status(400).json({ error: "Invalid scenarios JSON" });
    }
  }
  const args = ["playwright", "test"];
  if (grep) {
    args.push("--grep", grep);
  }
  const cwd = process.cwd();
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";

  const child = spawn(cmd, args, { cwd, env });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d.toString()));
  child.stderr.on("data", (d) => (stderr += d.toString()));

  child.on("close", (code) => {
    res.status(200).json({ code, stdout, stderr });
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  logger.info(`Test runner API listening on http://localhost:${port}`, "api");
});

export default app;
