import { expect, Page, Locator } from "@playwright/test";
import { customLogicMap } from "./custom-logic";
import type { TestStep, ValidationStep } from "./data-loader";
import { logger } from "./logger";

export class ActionExecutor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
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
    }

    // Support iteration if step.iterate is true and locator resolves to multiple elements
    // @ts-ignore allow iterate optional custom flag from JSON
    if ((step as any).iterate && locator) {
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const nthLocator = locator.nth(i);
        await this._executeAction(step, nthLocator, context);
      }
    } else {
      await this._executeAction(step, locator, context);
    }

    if (step.waitTime) {
      await this.page.waitForTimeout(step.waitTime);
    }

    if (step.validations) {
      for (const validation of step.validations) {
        await this.executeValidation(validation);
      }
    }
  }

  /**
   * Internal: Executes a single action on a locator or the page.
   */
  async _executeAction(step: TestStep, locator?: Locator, context: Record<string, any> = {}) {
    switch (step.action) {
      case "goto":
        await this.page.goto(String(step.path ?? "/"));
        break;
      case "fill":
        if (locator) await locator.fill(String(step.data ?? ""));
        break;
      case "type":
        if (locator) await locator.type(String(step.data ?? ""));
        break;
      case "click":
        if (locator) await locator.click();
        break;
      case "hover":
        if (locator) await locator.hover();
        break;
      case "press":
        if (locator) await locator.press(String(step.data ?? ""));
        break;
      case "waitForTimeout":
        if (step.waitTime) await this.page.waitForTimeout(step.waitTime);
        break;
      case "custom":
        // @ts-ignore allow customName from JSON
        if (!(step as any).customName || !customLogicMap[(step as any).customName]) {
          throw new Error(`Custom action '${(step as any).customName}' not found in customLogicMap.`);
        }
        // @ts-ignore allow customName from JSON
        await customLogicMap[(step as any).customName](this.page, step, context);
        break;
      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }

  async executeValidation(validation: ValidationStep) {
    const locator = validation.selector
      ? this.getLocator(
          validation.selector,
          (validation.selectorType as any) // narrow to supported types
        )
      : undefined;
    const currentExpect: typeof expect = validation.soft ? (expect as any).soft : expect;

    switch (validation.type) {
      case "toBeVisible": {
        if (!locator) throw new Error("toBeVisible requires a selector");
        await currentExpect(locator, validation.message).toBeVisible();
        break;
      }
      case "toBeHidden": {
        if (!locator) throw new Error("toBeHidden requires a selector");
        await currentExpect(locator, validation.message).toBeHidden();
        break;
      }
      case "toHaveTitle":
        await currentExpect(this.page, validation.message).toHaveTitle(String(validation.data ?? ""));
        break;
      case "toHaveURL":
        await currentExpect(this.page, validation.message).toHaveURL(new RegExp(String(validation.data ?? "")));
        break;
      case "toHaveText": {
        if (!locator) throw new Error("toHaveText requires a selector");
        await currentExpect(locator, validation.message).toHaveText(String(validation.data ?? ""));
        break;
      }
      case "toHaveValue": {
        if (!locator) throw new Error("toHaveValue requires a selector");
        await currentExpect(locator, validation.message).toHaveValue(String(validation.data ?? ""));
        break;
      }
      case "toHaveAttribute":
        if (!validation.attribute) {
          throw new Error(
            "Validation type 'toHaveAttribute' requires an 'attribute' key."
          );
        }
        if (!locator) throw new Error("toHaveAttribute requires a selector");
        await currentExpect(locator, validation.message).toHaveAttribute(validation.attribute, String(validation.data ?? ""));
        break;
      case "toHaveCSS":
        if (!validation.cssProperty) {
          throw new Error(
            "Validation type 'toHaveCSS' requires a 'cssProperty' key."
          );
        }
        if (!locator) throw new Error("toHaveCSS requires a selector");
        await currentExpect(locator, validation.message).toHaveCSS(validation.cssProperty, String(validation.data ?? ""));
        break;
      case "toHaveClass": {
        if (!locator) throw new Error("toHaveClass requires a selector");
        await currentExpect(locator, validation.message).toHaveClass(new RegExp(String(validation.data ?? "")));
        break;
      }
      default:
        logger.warn(`Unsupported validation type: ${validation.type}`, "ActionExecutor");
    }
  }
}
export default ActionExecutor;
