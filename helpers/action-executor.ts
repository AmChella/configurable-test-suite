import { expect, Page, Locator } from "@playwright/test";
import { customLogicMap, customValidationMap } from "./custom-logic";
import type { TestStep, ValidationStep } from "./data-loader";
import { logger } from "./logger";

export class ActionExecutor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Executes a sequence of test steps, supporting iterative step groups.
   * If steps are marked with iterativeGroup, the first step's selector determines iteration count
   * and subsequent steps in the group execute for each matching element.
   */
  async executeSteps(steps: TestStep[], context: Record<string, any> = {}) {
    let i = 0;
    while (i < steps.length) {
      const step = steps[i];

      // Check if this step starts an iterative group
      if (step.iterativeGroup) {
        const groupId = step.iterativeGroup;
        const groupSteps: TestStep[] = [];

        // Collect all consecutive steps with the same iterativeGroup ID
        let j = i;
        while (j < steps.length && steps[j].iterativeGroup === groupId) {
          groupSteps.push(steps[j]);
          j++;
        }

        // Execute the iterative group
        logger.info(`Executing iterative group: ${groupId} with ${groupSteps.length} steps`, "ActionExecutor");
        await this.executeIterativeGroup(groupSteps, context);

        // Skip to after the group
        i = j;
      } else {
        // Execute single step normally
        logger.info(`Executing step: ${step.stepName}`, "ActionExecutor");
        await this.executeStep(step, context);
        i++;
      }
    }
  }  /**
   * Executes a group of steps iteratively based on the first step's selector matches.
   *
   * Key behavior:
   * 1. The FIRST step's selector determines the number of iterations
   * 2. If step 1 selector finds N elements in the DOM, the entire group executes N times
   * 3. Each iteration processes one element (step1[0] -> step2[0], step1[1] -> step2[1], etc.)
   * 4. All steps in the group are executed completely for each iteration before moving to the next
   *
   * Example: If step 1 selector ".todo-list li" finds 5 elements, and you have steps 1,2,3 in the group:
   * - Iteration 1: Execute step1[0], step2[0], step3[0]
   * - Iteration 2: Execute step1[1], step2[1], step3[1]
   * - Iteration 3: Execute step1[2], step2[2], step3[2]
   * - Iteration 4: Execute step1[3], step2[3], step3[3]
   * - Iteration 5: Execute step1[4], step2[4], step3[4]
   */
  async executeIterativeGroup(groupSteps: TestStep[], context: Record<string, any> = {}) {
    if (groupSteps.length === 0) return;

    const firstStep = groupSteps[0];
    let mainLocator: Locator | undefined;

    // Get the main locator from the first step that determines iteration count
    if (firstStep.selector) {
      mainLocator = this.getLocator(firstStep.selector, firstStep.selectorType);
      if (typeof firstStep.nth === "number" && firstStep.nth >= 0) {
        mainLocator = mainLocator.nth(firstStep.nth);
      }
    }

    if (!mainLocator) {
      logger.warn("Iterative group first step has no selector, executing steps normally", "ActionExecutor");
      // Fallback to normal execution
      for (const step of groupSteps) {
        await this.executeStep(step, context);
      }
      return;
    }

    // Count how many elements match the first step's selector
    const elementCount = await mainLocator.count();
    logger.info(`Executing iterative group with ${elementCount} iterations based on selector: ${firstStep.selector}`, "ActionExecutor");

    // Execute all steps in the group for each matching element
    for (let i = 0; i < elementCount; i++) {
      const iterationContext = { ...context, iterationIndex: i, totalIterations: elementCount };
      logger.info(`Starting iteration ${i + 1}/${elementCount} for iterative group`, "ActionExecutor");

      for (const step of groupSteps) {
        await this.executeStepWithIteration(step, i, iterationContext);

        // Apply step-specific wait time
        if (step.waitTime) {
          await this.page.waitForTimeout(step.waitTime);
        }
      }
    }
  }

  /**
   * Executes a step with iteration context, modifying selectors to target the nth element.
   */
  async executeStepWithIteration(step: TestStep, iterationIndex: number, context: Record<string, any> = {}) {
    let locator: Locator | undefined;

    if (step.selector) {
      // Get base locator and target the specific iteration element
      const baseLocator = this.getLocator(step.selector, step.selectorType);

      // If the step has its own nth specified, use that, otherwise use iteration index
      const targetIndex = typeof step.nth === "number" && step.nth >= 0 ? step.nth : iterationIndex;
      locator = baseLocator.nth(targetIndex);
    }

    // Execute the action for this iteration
    await this._executeAction(step, locator, context);

        // Execute validations for this iteration
    if (step.validations) {
      for (const validation of step.validations) {
        // For validations, also apply iteration context if they have selectors
        let validationLocator = validation.selector
          ? this.getLocator(validation.selector, (validation.selectorType as any))
          : locator;

        // Apply iteration index to validation locator if it doesn't have its own nth
        if (validationLocator && validation.selector) {
          // If validation has its own nth, use that, otherwise use iteration index
          if (typeof (validation as any).nth === "number" && (validation as any).nth >= 0) {
            validationLocator = validationLocator.nth((validation as any).nth);
            logger.info(`Using validation nth: ${(validation as any).nth} for selector: ${validation.selector}`, "ActionExecutor");
          } else {
            // For iterative groups, scope validation selectors to the current iteration
            validationLocator = validationLocator.nth(iterationIndex);
            logger.info(`Using iteration index: ${iterationIndex} for validation selector: ${validation.selector}`, "ActionExecutor");
          }
        }

        await this.executeValidation(validation, { locator: validationLocator, context });
      }
    }
  }

  getLocator(selector: string, selectorType: "css" | "xpath" | "id" | "text" | "testId" = "css"): Locator {
    switch (selectorType) {
      case "css":
        return this.page.locator(selector);
      case "xpath":
        return this.page.locator(`xpath=${selector}`);
      case "id":
        return this.page.locator(`#${selector}`);
      case "text":
        return this.page.locator(`text=${selector}`);
      case "testId":
        return this.page.getByTestId(selector);
      default:
        throw new Error(`Unsupported selector type: ${selectorType}`);
    }
  }

  /**
   * Executes a test step, supporting configurable actions, iteration, and custom logic.
   */
  async executeStep(step: TestStep, context: Record<string, any> = {}) {
    let locator: Locator | undefined;
    if (step.selector) {
      locator = this.getLocator(step.selector, step.selectorType);
      if (typeof step.nth === "number" && step.nth >= 0) {
        locator = locator.nth(step.nth);
      }
    }

    // Support iteration if step.iterate is true and locator resolves to multiple elements
    // @ts-ignore allow iterate optional custom flag from JSON
    if ((step as any).iterate && locator) {
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const nthLocator = locator.nth(i);
        // Execute action for this iteration
        await this._executeAction(step, nthLocator, context);
        // Apply wait time per iteration if provided
        if (step.waitTime) {
          await this.page.waitForTimeout(step.waitTime);
        }
        // Execute validations for this iteration (use the iteration-specific locator)
        if (step.validations) {
          for (const validation of step.validations) {
            await this.executeValidation(validation, { locator: nthLocator, context });
          }
        }
      }
    } else {
      // Non-iterative path: single action, optional wait, then validations once
      await this._executeAction(step, locator, context);
      if (step.waitTime) {
        await this.page.waitForTimeout(step.waitTime);
      }
      if (step.validations) {
        for (const validation of step.validations) {
          await this.executeValidation(validation, { locator, context });
        }
      }
    }
  }

  /**
   * Internal: Executes a single action on a locator or the page.
   */
  async _executeAction(step: TestStep, locator?: Locator, context: Record<string, any> = {}) {
    switch (step.action) {
      case "goto":
        await this.page.goto(String(step.path ?? "/"), step.actionOptions as any);
        break;
      case "upload": {
        if (!locator) throw new Error("upload requires a selector pointing to an <input type='file'> element");
        // Two ways to provide files:
        // 1) step.files: array with { path | contentBase64, name, mimeType }
        // 2) step.data: string or array of strings with file paths
        const toUploads: any[] = [];
        const resolveFrom = step.resolveFrom || "cwd";
        const pathMod = require("path");

        if (Array.isArray(step.files) && step.files.length) {
          for (const f of step.files) {
            if (f.contentBase64) {
              const buf = Buffer.from(String(f.contentBase64), "base64");
              toUploads.push({ buffer: buf, name: f.name || "upload.bin", mimeType: f.mimeType });
            } else if (f.path) {
              const p = String(f.path);
              const resolvedPath = (resolveFrom === "cwd" && !(p.startsWith("/") || p.match(/^[A-Za-z]:\\\\/)))
                ? pathMod.resolve(process.cwd(), p)
                : p;
              toUploads.push(resolvedPath);
            }
          }
        } else {
          const asArray = Array.isArray(step.data) ? step.data : [step.data];
          const filePaths = asArray.filter((p) => !!p).map((p) => String(p));
          if (!filePaths.length) {
            throw new Error("upload action requires 'files' array or 'data' with a file path or array of file paths");
          }
          for (const p of filePaths) {
            const resolvedPath = (resolveFrom === "cwd" && !(p.startsWith("/") || p.match(/^[A-Za-z]:\\\\/)))
              ? pathMod.resolve(process.cwd(), p)
              : p;
            toUploads.push(resolvedPath);
          }
        }

        if (step.clearFirst) {
          await locator.setInputFiles([]);
        }
        await locator.setInputFiles(toUploads as any, step.actionOptions as any);
        break;
      }
      case "fill":
        if (locator) {
          const elementType = await locator.evaluate(el => el.tagName);
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(elementType) || (await locator.getAttribute('contenteditable') === 'true')) {
            await locator.fill(String(step.data ?? ""), step.actionOptions as any);
          } else {
            // If it's not a direct input, try to click it and then find an input within it.
            // This is a common pattern for search boxes that expand.
            await locator.click();
            const inputWithin = locator.locator('input, textarea, [contenteditable="true"]').first();
            if (await inputWithin.isVisible()) {
              await inputWithin.fill(String(step.data ?? ""), step.actionOptions as any);
            } else {
              throw new Error(`Cannot fill non-input element and no fillable input found after clicking: ${elementType}`);
            }
          }
        }
        break;
      case "type":
        if (locator) await locator.type(String(step.data ?? ""), step.actionOptions as any);
        break;
      case "click":
        if (locator) await locator.click(step.actionOptions as any);
        break;
      case "hover":
        if (locator) await locator.hover(step.actionOptions as any);
        break;
      case "press":
        if (locator) await locator.press(String(step.data ?? ""), step.actionOptions as any);
        break;
      case "waitForTimeout":
        if (step.waitTime) await this.page.waitForTimeout(step.waitTime);
        break;
      case "custom":
        if (!step.customName || !customLogicMap[step.customName]) {
          throw new Error(`Custom action '${step.customName}' not found in customLogicMap.`);
        }
        await customLogicMap[step.customName](this.page, step, context, locator);
        break;
      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }

  async executeValidation(validation: ValidationStep, extras: { locator?: Locator; context?: Record<string, any> } = {}) {
    // Priority: If validation specifies its own selector, build a fresh locator.
    // Otherwise fall back to the passed locator (e.g., from iteration context).
    let locator: Locator | undefined;
    if (validation.selector) {
      locator = this.getLocator(
        validation.selector,
        (validation.selectorType as any)
      );
      if (locator && typeof (validation as any).nth === "number" && (validation as any).nth >= 0) {
        locator = locator.nth((validation as any).nth as number);
      }
    } else if (extras.locator) {
      locator = extras.locator;
    }

    const currentExpect: typeof expect = validation.soft ? (expect as any).soft : expect;
    const opts = (validation as any).expectOptions as any;

    switch (validation.type) {
      case "toBeVisible": {
        if (!locator) throw new Error("toBeVisible requires a selector");
        await currentExpect(locator, validation.message).toBeVisible(opts);
        break;
      }
      case "toBeHidden": {
        if (!locator) throw new Error("toBeHidden requires a selector");
        await currentExpect(locator, validation.message).toBeHidden(opts);
        break;
      }
      case "toHaveTitle":
        await currentExpect(this.page, validation.message).toHaveTitle(String(validation.data ?? ""), opts);
        break;
      case "toHaveURL":
        await currentExpect(this.page, validation.message).toHaveURL(new RegExp(String(validation.data ?? "")), opts);
        break;
      case "toHaveText": {
        if (!locator) throw new Error("toHaveText requires a selector");
        await currentExpect(locator, validation.message).toHaveText(String(validation.data ?? ""), opts);
        break;
      }
      case "toHaveValue": {
        if (!locator) throw new Error("toHaveValue requires a selector");
        await currentExpect(locator, validation.message).toHaveValue(String(validation.data ?? ""), opts);
        break;
      }
      case "toContainText": {
        if (!locator) throw new Error("toContainText requires a selector");
        await currentExpect(locator, validation.message).toContainText(String(validation.data ?? ""), opts);
        break;
      }
      case "toHaveAttribute":
        if (!validation.attribute) {
          throw new Error(
            "Validation type 'toHaveAttribute' requires an 'attribute' key."
          );
        }
        if (!locator) throw new Error("toHaveAttribute requires a selector");
        await currentExpect(locator, validation.message).toHaveAttribute(validation.attribute, String(validation.data ?? ""), opts);
        break;
      case "toHaveCSS":
        if (!validation.cssProperty) {
          throw new Error(
            "Validation type 'toHaveCSS' requires a 'cssProperty' key."
          );
        }
        if (!locator) throw new Error("toHaveCSS requires a selector");
        await currentExpect(locator, validation.message).toHaveCSS(validation.cssProperty, String(validation.data ?? ""), opts);
        break;
      case "toHaveClass": {
        if (!locator) throw new Error("toHaveClass requires a selector");
        await currentExpect(locator, validation.message).toHaveClass(new RegExp(String(validation.data ?? "")), opts);
        break;
      }
      case "custom": {
        const name = validation.customName;
        if (!name || !customValidationMap[name]) {
          throw new Error(`Custom validation '${name}' not found in customValidationMap.`);
        }
        await customValidationMap[name](
          this.page as any,
          validation as any,
          { locator, expect: currentExpect, ...(extras.context || {}) },
          locator as any
        );
        break;
      }
      default:
        logger.warn(`Unsupported validation type: ${validation.type}`, "ActionExecutor");
    }
  }
}
export default ActionExecutor;
