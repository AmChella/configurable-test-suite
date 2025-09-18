import e from "express";
import { logger } from "./logger";
export const selectWord = async (
  page,
  step,
  context,
  word,
  element,
  selectionType = "random"
) => {
  logger.info("Executing custom logic 'selectWord'", "customLogic.selectWord");
  if (!word) {
    throw new Error("Arg 'word' is empty.");
  }
  const {
    selector,
    nth = 0,
    mode = "mouse", // mouse | keyboard | auto
    method = "double", // for mouse: double | drag
    wordwise = false, // for keyboard: use word-wise selection chords
  } = step.data as {
    word: string;
    selector?: string;
    nth?: number;
    mode?: "mouse" | "keyboard" | "auto";
    method?: "double" | "drag";
    wordwise?: boolean;
  };

  // Get bounding box for the requested occurrence of the word
  const box = await page.evaluate(
    ({
      word,
      selector,
      nth,
      element,
    }: {
      word: string;
      selector?: string;
      nth: number;
      element: any;
    }) => {
      function findRangeForWord(
        root: Element | Document,
        word: string,
        nth: number,
        element: any
      ): Range | null {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let count = 0;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const txt = (node as Text).data;
          let startIndex = 0;
          while (true) {
            const idx = txt.indexOf(word, startIndex);
            if (idx === -1) break;
            if (count === nth) {
              range.setStart(node, idx);
              range.setEnd(node, idx + word.length);
              return range;
            }
            count++;
            startIndex = idx + word.length;
          }
        }
        return null;
      }
      console.log("word in page.evaluate:", word);
      const root: Element | Document = selector
        ? (document.querySelector(selector) as Element) || document
        : document;
      const targetRange = findRangeForWord(root, word, nth, element);
      if (!targetRange) return null;
      const rects = targetRange.getClientRects();
      const first = rects[0];
      const last = rects[rects.length - 1];
      const bounds = targetRange.getBoundingClientRect();
      return {
        startX: first?.left ?? bounds.left,
        startY: first?.top ?? bounds.top,
        endX: last?.right ?? bounds.right,
        endY: last?.bottom ?? bounds.bottom,
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
      };
    },
    { word, selector, nth, element } as { word: string; selector?: string; nth: number; element: any }
  );

  if (!box) {
    throw new Error(
      `Word '${word}' not found${selector ? ` within '${selector}'` : ""}.`
    );
  }

  // Ensure target area is in view
  await page.mouse.move(box.centerX, box.centerY);

  const effectiveMode = mode === "auto" ? "mouse" : mode;
  if (effectiveMode === "mouse") {
    if (method === "double") {
      await page.mouse.click(box.centerX, box.centerY, { clickCount: 2 });
    } else {
      // drag selection from start to end
      await page.mouse.move(box.startX, box.startY);
      await page.mouse.down();
      await page.mouse.move(box.endX, box.endY);
      await page.mouse.up();
    }
    return;
  }

  // Keyboard selection
  // Click at start, then extend selection to the right
  await page.mouse.click(box.startX, box.startY);
  if (wordwise) {
    const plat = process.platform;
    // Word-wise selection chords differ by OS
    const chord =
      plat === "darwin"
        ? "Alt+Shift+ArrowRight"
        : plat === "win32"
        ? "Control+Shift+ArrowRight"
        : "Alt+Shift+ArrowRight";
    await page.keyboard.press(chord);
  } else {
    for (let i = 0; i < String(word).length; i++) {
      await page.keyboard.press("Shift+ArrowRight");
    }
  }
};

export const readTextNodes = async (
  element: any,
  excludedTags: string[] = []
): Promise<string[]> => {
  const elementHandle = await element.elementHandle();
  if (elementHandle) {
     return await elementHandle.evaluate(
        (el: HTMLElement, excluded: string[]) => {
          const EXCLUDED_TAGS: string[] = [
            ...excluded.map((tag: string) => tag.toUpperCase()),
          ];
          function getTextNodes(node: Node): string[] {
            const nodes: string[] = [];
            for (const child of Array.from(node.childNodes) as Node[]) {
              if (child.nodeType === Node.TEXT_NODE) {
                const textChild = child as Text;
                if (textChild.textContent && textChild.textContent.trim()) {
                  const parent = textChild.parentElement as HTMLElement | null;
                  if (!(parent && EXCLUDED_TAGS.includes(parent.tagName))) {
                    nodes.push(textChild.textContent.trim());
                  }
                }
              } else if (
                child.nodeType === Node.ELEMENT_NODE &&
                !EXCLUDED_TAGS.includes((child as HTMLElement).tagName)
              ) {
                nodes.push(...getTextNodes(child));
              }
            }
            return nodes;
          }
          return getTextNodes(el);
        },
        excludedTags
      );
  }
  return [];
};
