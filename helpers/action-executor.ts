import { Page, expect } from "@playwright/test";
import { TestStep, ValidationStep } from "./data-loader";

export class ActionExecutor {
  constructor(private page: Page) {}

  private getLocator(selector: string, selectorType: string = "css") {
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

  async executeStep(step: TestStep) {
    let locator;
    if (step.selector) {
      locator = this.getLocator(step.selector, step.selectorType);
    }

    switch (step.action) {
      case "goto":
        await this.page.goto(step.data);
        break;
      case "fill":
        await locator?.fill(step.data);
        break;
      case "click":
        await locator?.click();
        break;
      case "press":
        await locator?.press(step.data);
        break;
      case "waitForTimeout":
        if (step.waitTime) await this.page.waitForTimeout(step.waitTime);
        break;
      default:
        throw new Error(`Unsupported action: ${step.action}`);
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

  async executeValidation(validation: ValidationStep) {
    const locator = validation.selector
      ? this.getLocator(validation.selector, validation.selectorType)
      : undefined;
    const currentExpect = validation.soft ? expect.soft : expect;

    switch (validation.type) {
      case "toBeVisible":
        await currentExpect(locator, validation.message).toBeVisible();
        break;
      case "toHaveTitle":
        await currentExpect(this.page, validation.message).toHaveTitle(
          validation.data
        );
        break;
      case "toHaveURL":
        await currentExpect(this.page, validation.message).toHaveURL(
          new RegExp(validation.data)
        );
        break;
      case "toHaveText":
        await currentExpect(locator, validation.message).toHaveText(
          validation.data
        );
        break;
      case "toHaveValue":
        await currentExpect(locator, validation.message).toHaveValue(
          validation.data
        );
        break;
      case "toHaveAttribute":
        if (!validation.attribute) {
          throw new Error(
            "Validation type 'toHaveAttribute' requires an 'attribute' key."
          );
        }
        await currentExpect(locator, validation.message).toHaveAttribute(
          validation.attribute,
          validation.data
        );
        break;
      case "toHaveCSS":
        if (!validation.cssProperty) {
          throw new Error(
            "Validation type 'toHaveCSS' requires a 'cssProperty' key."
          );
        }
        await currentExpect(locator, validation.message).toHaveCSS(
          validation.cssProperty,
          validation.data
        );
        break;
      case "toHaveClass":
        await currentExpect(locator, validation.message).toHaveClass(
          new RegExp(validation.data)
        );
        break;
      default:
        console.warn(`Unsupported validation type: ${validation.type}`);
    }
  }
}
