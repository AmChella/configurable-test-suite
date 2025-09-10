import * as fs from "fs";
import * as path from "path";

const SCENARIO_DIR = path.resolve(__dirname, "../data/ui-scenarios");

export interface ValidationStep {
  type: string;
  selector?: string;
  selectorType?: string;
  data?: any;
  soft?: boolean;
  message?: string;
  attribute?: string;
  cssProperty?: string;
}

export interface TestStep {
  stepName: string;
  action: string;
  selector?: string;
  selectorType?: "css" | "xpath" | "id" | "text" | "testId";
  data?: any;
  waitTime?: number;
  validations?: ValidationStep[];
}

export interface TestConfig {
  description: string;
  enabled: boolean;
  testSteps: TestStep[];
}

export const loadTestScenarios = (): TestConfig[] => {
  if (!fs.existsSync(SCENARIO_DIR)) {
    console.error(`Scenario directory not found: ${SCENARIO_DIR}`);
    return [];
  }

  const files = fs
    .readdirSync(SCENARIO_DIR)
    .filter((file) => file.endsWith(".json"));
  const scenarios: TestConfig[] = [];

  for (const file of files) {
    const filePath = path.join(SCENARIO_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    try {
      const config = JSON.parse(content) as TestConfig;
      if (config.enabled) {
        scenarios.push(config);
      }
    } catch (e) {
      console.error(`Failed to parse JSON file: ${file}`, e);
    }
  }
  return scenarios;
};
