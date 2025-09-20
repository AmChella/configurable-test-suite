import { expect } from "allure-playwright";
import { logger } from "./logger";
import { isWrappedByGivenTag, readTextNodes, selectWord } from "./utility";

// Custom logic map for ActionExecutor
// Add your custom functions here. Each function receives (page, step, context)
// Example: 'myCustomAction': async (page, step, context) => { /* custom logic */ },
export const customLogicMap: Record<
  string,
  (
    page: any,
    step: any,
    context: Record<string, any>,
    element: any
  ) => Promise<void>
> = {
  // 'myCustomAction': async (page, step, context) => { /* ... */ },
  queryResponse: async (page, step, context, element) => {
    // Example custom logic: Log the step data and context
    const textarea = page.locator(step.data.selector.fillResponse);
    logger.info(
      `Filling response in textarea: ${textarea}`,
      "customLogic.queryResponse"
    );
    if ((await textarea.count()) > 0) {
      await textarea.fill(String(step.data?.responseText ?? ""));
    }

    const done = page.locator(step.data.selector.clickDone);
    if ((await done.count()) > 0) {
      logger.info("Clicking done button", "customLogic.queryResponse");
      await done.click();
    }
  },
  format: async (page, step, context, element) => {
    logger.info("Executing custom logic 'format'", "customLogic.format");
    const EXCLUDED_TAGS = ["A"]; // Extendable list of tags to ignore
    try {
      // Collect raw text node strings excluding certain tags
      let chosen: string | undefined;
      let stepWithWord: any = step;
      if (step.data.wordSelection === "random") {
        let nodeTexts: string[] = await readTextNodes(element, EXCLUDED_TAGS);
        nodeTexts = nodeTexts.filter((t) => t && t.trim());
        if (!nodeTexts.length) {
          logger.warn(
            "No text nodes found to select from",
            "customLogic.format"
          );
          return;
        }
        // Split into individual words (tokens) by whitespace
        const tokenWords = nodeTexts
          .flatMap((t) => t.split(/\s+/))
          .filter(Boolean);
        if (!tokenWords.length) {
          logger.warn(
            "No individual words extracted after splitting",
            "customLogic.format"
          );
          return;
        }
        // Pick a single random word (the user's request: choose any one word)
        chosen = tokenWords[Math.floor(Math.random() * tokenWords.length)];
        logger.info(`Chosen word: ${chosen}`, "customLogic.format");
        // Prepare a shallow cloned step with injected word for selectWord logic
        stepWithWord = {
          ...step,
          data: { ...(step.data || {}), word: chosen },
        };
      } else if (step.data.wordSelection === "specific") {
        if (!step.data.word || typeof step.data.word !== "string") {
          logger.warn(
            "Custom format action requires 'data.word' for specific selection",
            "customLogic.format"
          );
          return;
        }
        chosen = step.data.word;
        logger.info(`Chosen specific word: ${chosen}`, "customLogic.format");
        stepWithWord = { ...step }; // no change needed
      } else {
        logger.warn(
          `Unknown wordSelection type: ${step.data.wordSelection}`,
          "customLogic.format"
        );
        return;
      }
      if (!chosen) {
        logger.warn(
          "No word chosen during format action",
          "customLogic.format"
        );
        return;
      }
      // Reuse selectWord helper (expects signature selectWord(page, step, context, selectionType?))
      await selectWord(
        page,
        stepWithWord,
        context,
        chosen,
        element,
        "specific"
      );
      await page.locator(step.data.selector).waitFor({ state: "visible" });
      await page.locator(step.data.selector).click();
      // Structural assertion: ensure the chosen word is inside a <strong> or <b> element
      const isWrapped = await isWrappedByGivenTag(
        element,
        chosen,
        step.data.wrappers
      );
      await expect
        .soft(
          isWrapped,
          `Expected word "${chosen}" to be wrapped in <strong>/<b> inside ${element}`
        )
        .toBeTruthy();
    } catch (e) {
      logger.warn(
        `Failed to process format action: ${(e as Error).message}`,
        "customLogic.format"
      );
    }
  },
};
export default customLogicMap;

// Custom validation map for ActionExecutor
// Each function should throw an Error to fail the validation, or return/resolves if it passes.
export const customValidationMap: Record<
  string,
  (
    page: any,
    validation: any,
    context: Record<string, any>,
    element: any
  ) => Promise<void>
> = {
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
      throw new Error(
        "Custom validation 'containsText' requires 'data' with expected substring"
      );
    }
    const loc = validation.selector ? context.locator : undefined;
    let haystack: string | null = null;
    if (loc) {
      try {
        haystack = await loc.textContent();
      } catch (e) {
        // Fallback to innerText if textContent fails
        haystack = await page.evaluate(
          (el: HTMLElement) => el.innerText,
          await loc.elementHandle()
        );
      }
    } else {
      haystack = await page.content();
    }
    haystack = haystack ?? "";
    if (!haystack.includes(targetText)) {
      const msg =
        validation.message || `Expected text to include: ${targetText}`;
      throw new Error(msg);
    }
    // Optionally also use expect if provided
    if (context.expect && loc) {
      await context.expect(haystack, validation.message).toContain(targetText);
    }
  },
};
