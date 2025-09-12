import { test } from "@playwright/test";
import { loadTestScenarios } from "../../helpers/data-loader";
import { ActionExecutor } from "../../helpers/action-executor";
import { logger } from "../../helpers/logger";

// test.use({ baseURL: "https://practicetestautomation.com" });

const scenarios = loadTestScenarios();

for (const scenario of scenarios) {
  test.describe(scenario.description, () => {
    test(`Run scenario: ${scenario.description}`, async ({ page }) => {
      const executor = new ActionExecutor(page);

      for (const step of scenario.testSteps) {
        await test.step(step.stepName, async () => {
          logger.info(`Executing step: ${step.stepName}`, "runner");
          await executor.executeStep(step);
        });
      }
    });
  });
}
