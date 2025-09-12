import { logger } from "./logger";

// Custom logic map for ActionExecutor
// Add your custom functions here. Each function receives (page, step, context)
// Example: 'myCustomAction': async (page, step, context) => { /* custom logic */ },
export const customLogicMap: Record<string, (page: any, step: any, context: Record<string, any>) => Promise<void>> = {
  // 'myCustomAction': async (page, step, context) => { /* ... */ },
  "queryResponse": async (page, step, context) => {
    // Example custom logic: Log the step data and context
    const textarea = page.locator(step.data.selector.fillResponse);
    if ((await textarea.count()) > 0) {
      await textarea.fill(String(step.data?.responseText ?? ""));
    }

    const done = page.locator(step.data.selector.clickDone);
    if ((await done.count()) > 0) {
      await done.click();
    }
  },
  "selectWord": async (page, step, context) => {
    logger.info("Executing custom logic 'selectWord'", "customLogic.selectWord");
    if (!step.data || !step.data.word) {
      throw new Error("Step data must include a 'word' property.");
    }
    const wordToSelect = step.data.word;

    // Use page.evaluate to run JavaScript in the browser context
    await page.evaluate((word: string) => {
      const range = document.createRange();
      const selection = window.getSelection();
      const textNodes: Text[] = [];

      // Helper function to get all text nodes
      function getTextNodes(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node as Text);
        } else {
          node.childNodes.forEach(getTextNodes as any);
        }
      }

      getTextNodes(document.body);

      for (const textNode of textNodes) {
        const index = textNode.textContent?.indexOf(word) ?? -1;
        if (index !== -1) {
          range.setStart(textNode, index);
          range.setEnd(textNode, index + word.length);
          selection?.removeAllRanges();
          selection?.addRange(range);
          break;
        }
      }
    }, wordToSelect);
  },
};
export default customLogicMap;
