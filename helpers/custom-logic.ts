// Custom logic map for ActionExecutor
// Add your custom functions here. Each function receives (page, step, context)

// Custom logic map for ActionExecutor (JS version)
// Add your custom functions here. Each function receives (page, step, context)
// Example: 'myCustomAction': async (page, step, context) => { /* custom logic */ },
const customLogicMap = {
  // 'myCustomAction': async (page, step, context) => { /* ... */ },
  "queryResponse": async (page, step, context) => {
    // Example custom logic: Log the step data and context
    const textarea = page.locator(step.data.selector.fillResponse); //"textarea#response-textarea";
    if ((await textarea.count()) > 0) {
      await textarea.fill(`Response for query ${i}`);
    }

    const done = page.locator(step.data.selector.clickDone); // "button:has-text('Done')"
    if ((await done.count()) > 0) {
      await done.click();
    }
  },
  "selectWord": async (page, step, context) => {
    console.log("Executing custom logic 'selectWord'");
    if (!step.data || !step.data.word) {
      throw new Error("Step data must include a 'word' property.");
    }
    const wordToSelect = step.data.word;

    // Use page.evaluate to run JavaScript in the browser context
    await page.evaluate((word) => {
      const range = document.createRange();
      const selection = window.getSelection();
      const textNodes = [];

      // Helper function to get all text nodes
      function getTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node);
        } else {
          node.childNodes.forEach(getTextNodes);
        }
      }

      getTextNodes(document.body);

      for (const textNode of textNodes) {
        const index = textNode.textContent.indexOf(word);
        if (index !== -1) {
          range.setStart(textNode, index);
          range.setEnd(textNode, index + word.length);
          selection.removeAllRanges();
          selection.addRange(range);
          break;
        }
      }
    }, wordToSelect);
  },
};

module.exports = { customLogicMap };
