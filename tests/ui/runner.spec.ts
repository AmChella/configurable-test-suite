import { test } from "@playwright/test";
import { loadTestScenarios } from "../../helpers/data-loader";
import { ActionExecutor } from "../../helpers/action-executor";
import { logger } from "../../helpers/logger";

const scenarios = loadTestScenarios();

for (const scenario of scenarios) {
  test.describe(scenario.description, () => {
    test(`Run scenario: ${scenario.description}`, async ({ page }) => {
      const executor = new ActionExecutor(page);
      
      // Use executeSteps to handle both normal steps and iterative groups
      await executor.executeSteps(scenario.testSteps);
    });
  });
}
