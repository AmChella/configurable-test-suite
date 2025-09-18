import { get } from "http";
import { logger } from "./logger";
import { readTextNodes, selectWord } from "./utility";

// Custom logic map for ActionExecutor
// Add your custom functions here. Each function receives (page, step, context)
// Example: 'myCustomAction': async (page, step, context) => { /* custom logic */ },
export const customLogicMap: Record<string, (page: any, step: any, context: Record<string, any>, element: any) => Promise<void>> = {
  // 'myCustomAction': async (page, step, context) => { /* ... */ },
  "queryResponse": async (page, step, context, element) => {
    // Example custom logic: Log the step data and context
    const textarea = page.locator(step.data.selector.fillResponse);
    logger.info(`Filling response in textarea: ${textarea}`, "customLogic.queryResponse");
    if ((await textarea.count()) > 0) {
      await textarea.fill(String(step.data?.responseText ?? ""));
    }

    const done = page.locator(step.data.selector.clickDone);
    if ((await done.count()) > 0) {
      logger.info("Clicking done button", "customLogic.queryResponse");
      await done.click();
    }
  },
  "format": async (page, step, context, element, selectionType = "random") => {
    logger.info("Executing custom logic 'format'", "customLogic.format");
    // Get all child nodes, filter out excluded tags and pure text nodes
    const EXCLUDED_TAGS = ["A"];
    // Use imported getTextNodes utility directly

    let words: string[] = [];
    try {
      words = await readTextNodes(element, EXCLUDED_TAGS);
      words = words.filter((word) => word.trim() !== "");
      let randomWords = words.sort(() => 0.5 - Math.random()).slice(0, 3);
      await selectWord(page, step, context, randomWords, element, "specific");

    } catch (e) {
      logger.warn(`Failed to get text nodes: ${e}`, "customLogic.format");
    }
  },
};
export default customLogicMap;

// Custom validation map for ActionExecutor
// Each function should throw an Error to fail the validation, or return/resolves if it passes.
export const customValidationMap: Record<string, (page: any, validation: any, context: Record<string, any>, element: any) => Promise<void>> = {
  // Example: Validate that an element (or entire page) contains specific text
  // Usage in JSON:
  // {
  //   "type": "custom",
  //   "customName": "containsText",
  //   "selector": ".product-name", // optional
  //   "data": "Premium Product",
  //   "message": "Product name should include Premium Product"
  // }
  async containsText(page, validation, context) {
    const targetText = String(validation.data ?? "");
    if (!targetText) {
      throw new Error("Custom validation 'containsText' requires 'data' with expected substring");
    }
    const loc = validation.selector ? context.locator : undefined;
    let haystack: string | null = null;
    if (loc) {
      try {
        haystack = await loc.textContent();
      } catch (e) {
        // Fallback to innerText if textContent fails
        haystack = await page.evaluate((el: HTMLElement) => el.innerText, await loc.elementHandle());
      }
    } else {
      haystack = await page.content();
    }
    haystack = haystack ?? "";
    if (!haystack.includes(targetText)) {
      const msg = validation.message || `Expected text to include: ${targetText}`;
      throw new Error(msg);
    }
    // Optionally also use expect if provided
    if (context.expect && loc) {
      await context.expect(haystack, validation.message).toContain(targetText);
    }
  },
};
