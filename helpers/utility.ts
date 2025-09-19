import { logger } from "./logger";
export const selectWord = async (
  page: any,
  step: any,
  context: Record<string, any>,
  wordToSelect: string,
  element: any,
  selectionType = "random"
) => {
  logger.info("Executing custom logic 'selectWord'", "customLogic.selectWord");
  if (!wordToSelect) {
    throw new Error("Arg 'wordToSelect' is empty.");
  }
  const handle = element?.elementHandle ? await element.elementHandle() : element;
  if (!handle) throw new Error("Element handle not available for selectWord.");
  // Ensure the element is scrolled into view before attempting selection
  try {
    // Playwright ElementHandle API provides scrollIntoViewIfNeeded
    if (typeof handle.scrollIntoViewIfNeeded === "function") {
      await handle.scrollIntoViewIfNeeded();
    } else {
      await handle.evaluate((el: HTMLElement) => {
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "center", inline: "center" });
        }
      });
    }
  } catch (e) {
    logger.warn(`scrollIntoView failed: ${(e as Error).message}`, "customLogic.selectWord");
  }
  await handle.evaluate(
    (el: HTMLElement, word: string, selType: string) => {
      // Helper to escape regex special chars
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();

      // Collect all occurrences across text nodes
      interface Occ { node: Text; index: number; length: number; text: string }
      const occurrences: Occ[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (node: Node) => {
          if (!(node.parentElement)) return NodeFilter.FILTER_REJECT;
          // skip script/style tags etc.
          const tag = node.parentElement.tagName;
          if (["SCRIPT", "STYLE"].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const isWord = /^(\w+)$/i.test(word);
      const pattern = isWord ? new RegExp(`\\b${escapeRegex(word)}\\b`, "g") : new RegExp(escapeRegex(word), "g");

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        const textContent = textNode.textContent || "";
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(textContent)) !== null) {
          occurrences.push({ node: textNode, index: match.index, length: match[0].length, text: match[0] });
          // Prevent infinite loop for zero-length matches
          if (match.index === pattern.lastIndex) pattern.lastIndex++;
        }
      }

      if (!occurrences.length) {
        return; // nothing found
      }

      let chosen: Occ;
      if (selType === "random") {
        chosen = occurrences[Math.floor(Math.random() * occurrences.length)];
      } else {
        // default to first occurrence for specific selection
        chosen = occurrences[0];
      }

      const range = document.createRange();
      range.setStart(chosen.node, chosen.index);
      range.setEnd(chosen.node, chosen.index + chosen.length);
      if (selection) selection.addRange(range);
    },
    wordToSelect,
    selectionType
  );
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

export const isWrappedByGivenTag = async (element: any, chosen: string, tags: string[]): Promise<boolean> => {
  return await element.evaluate(
    (el: HTMLElement, { word, tags }: { word: string; tags: string[] }) => {
      if (!word) return false;
      const norm = (s: string) => s.trim();
      const candidates = el.querySelectorAll(tags.join(","));
      for (const cand of Array.from(candidates)) {
        const text = cand.textContent || '';
        // Direct exact match (with or without surrounding punctuation stripped)
        const stripped = text.replace(/[\.,;:!?'"()\[\]{}]/g, '').trim();
        if (norm(text) === word || stripped === word) return true;
        // Token based (word contained among whitespace tokens)
        const tokens = text.split(/\s+/).map(norm).filter(Boolean);
        if (tokens.includes(word)) return true;
      }
      return false;
    },
    { word: chosen, tags }
  );
};