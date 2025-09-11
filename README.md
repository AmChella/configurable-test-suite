# Configurable Test Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.55+-red)](https://playwright.dev/)

A powerful, JSON-driven test automation framework built on Playwright that enables teams to create comprehensive UI test suites without writing code. Define your test scenarios in simple JSON configuration files and let the framework handle the execution.

## ✨ Key Features

- 🎯 **Zero-Code Testing**: Write tests using JSON configuration files
- 🔧 **Highly Configurable**: Support for multiple selector types, validation methods, and custom actions
- 🚀 **Built on Playwright**: Leverage the power and reliability of Microsoft's Playwright
- 🌍 **Environment Agnostic**: Easy configuration for different environments (dev, staging, production)
- 🔄 **Reusable Components**: Create modular test steps that can be shared across scenarios
- 📊 **Rich Reporting**: Generate detailed HTML reports with screenshots and traces
- 🛠 **Extensible**: Add custom actions and validations through the extensibility system
- ⚡ **Fast Execution**: Parallel test execution and smart retry mechanisms

## 🏗️ Architecture Overview

The framework follows a modular architecture designed for maintainability and extensibility:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   JSON Config   │───▶│   Data Loader   │───▶│ Action Executor │
│   Scenarios     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Test Validator  │    │   Custom Logic  │
                       │                 │    │    Extensions   │
                       └─────────────────┘    └─────────────────┘
```

### Core Components

- **Data Loader**: Reads and parses JSON test scenarios, handles token replacement
- **Action Executor**: Executes UI actions (click, type, navigate, etc.)
- **Test Validator**: Performs assertions and validations on UI elements
- **Custom Logic**: Extensible system for domain-specific test actions
- **Environment Manager**: Handles environment-specific configurations

## 🚀 Quick Start

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AmChella/configurable-test-suite.git
   cd configurable-test-suite
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

4. **Set up environment variables**:
   ```bash
   # Create your environment file
   cp configs/dev.env configs/local.env

   # Edit the configuration
   echo "BASE_URL=https://your-app.com" >> configs/local.env
   echo "TOKEN=your-auth-token" >> configs/local.env
   ```

5. **Run your first test**:
   ```bash
   ENV=local npm test
   ```

## ⚙️ Configuration

### Environment Variables

The framework supports environment-specific configurations through `.env` files in the `configs/` directory:

| Variable | Description | Default |
|----------|-------------|--------|
| `BASE_URL` | Base URL for your application | `http://localhost:4000` |
| `TOKEN` | Authentication token for API calls | - |
| `CI` | Continuous integration mode | `false` |

### Project Structure

```
configurable-test-suite/
├── configs/                 # Environment configurations
│   ├── dev.env             # Development environment
│   └── prod.env            # Production environment
├── data/
│   └── ui-scenarios/       # JSON test scenario files
│       ├── login.json
│       └── checkout.json
├── helpers/                # Core framework files
│   ├── action-executor.ts  # Main action execution engine
│   ├── data-loader.ts      # JSON scenario loader
│   └── custom-logic.ts     # Custom action definitions
├── tests/
│   └── ui/
│       └── runner.spec.ts  # Main test runner
└── playwright.config.ts    # Playwright configuration
```

## 📝 Writing Test Scenarios

### Basic Scenario Structure

Test scenarios are defined in JSON files following this structure:

```json path=null start=null
{
  "description": "Login Flow Test",
  "enabled": true,
  "testOrder": 1,
  "testSteps": [
    {
      "stepName": "Navigate to login page",
      "action": "goto",
      "path": "/login"
    },
    {
      "stepName": "Enter username",
      "action": "fill",
      "selector": "#username",
      "data": "testuser@example.com"
    },
    {
      "stepName": "Click login button",
      "action": "click",
      "selector": "button[type='submit']",
      "validations": [
        {
          "type": "toBeVisible",
          "selector": ".dashboard",
          "message": "Dashboard should be visible after login"
        }
      ]
    }
  ]
}
```

### Advanced Example with Custom Logic

```json path=null start=null
{
  "description": "Product Selection with Custom Logic",
  "enabled": true,
  "testOrder": 2,
  "testSteps": [
    {
      "stepName": "Select product by text",
      "action": "custom",
      "customName": "selectWord",
      "data": {
        "word": "Premium Product"
      }
    },
    {
      "stepName": "Validate multiple elements",
      "action": "waitForTimeout",
      "waitTime": 2000,
      "validations": [
        {
          "type": "toHaveText",
          "selector": ".product-name",
          "data": "Premium Product",
          "soft": true
        },
        {
          "type": "toBeVisible",
          "selector": ".add-to-cart",
          "message": "Add to cart button should be visible"
        }
      ]
    }
  ]
}
```

## 🎯 Supported Actions

| Action | Description | Parameters |
|--------|-------------|-----------|
| `goto` | Navigate to a URL | `path` - URL or path to navigate to |
| `click` | Click on an element | `selector` - Element selector |
| `fill` | Fill input field | `selector` - Input selector, `data` - Text to fill |
| `type` | Type text character by character | `selector` - Input selector, `data` - Text to type |
| `hover` | Hover over an element | `selector` - Element selector |
| `press` | Press keyboard keys | `selector` - Element selector, `data` - Key to press |
| `waitForTimeout` | Wait for specified time | `waitTime` - Milliseconds to wait |
| `custom` | Execute custom logic | `customName` - Name of custom function, `data` - Custom data |

## 🔍 Selector Types

The framework supports multiple selector strategies:

| Type | Description | Example |
|------|-------------|--------|
| `css` | CSS selector (default) | `.class-name`, `#id`, `button` |
| `xpath` | XPath selector | `//button[@class='submit']` |
| `id` | Element ID | `username` (becomes `#username`) |
| `text` | Text content | `Login` (finds element containing "Login") |
| `testId` | Test ID attribute | `login-btn` (finds `[data-testid='login-btn']`) |

## ✅ Validation Types

| Validation | Description | Parameters |
|------------|-------------|-----------|
| `toBeVisible` | Element is visible | `selector` |
| `toBeHidden` | Element is hidden | `selector` |
| `toHaveTitle` | Page has specific title | `data` - Expected title |
| `toHaveURL` | Page URL matches pattern | `data` - URL pattern |
| `toHaveText` | Element contains text | `selector`, `data` - Expected text |
| `toHaveValue` | Input has specific value | `selector`, `data` - Expected value |
| `toHaveAttribute` | Element has attribute | `selector`, `attribute`, `data` - Expected value |
| `toHaveCSS` | Element has CSS property | `selector`, `cssProperty`, `data` - Expected value |
| `toHaveClass` | Element has CSS class | `selector`, `data` - Class pattern |

## 🛠 Custom Actions

Extend the framework with custom actions by modifying `helpers/custom-logic.ts`:

```typescript path=/Users/che/code/Office/configurable-test-suite/helpers/custom-logic.ts start=9
const customLogicMap = {
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
```

### Creating Custom Actions

1. **Add your function to the customLogicMap**:
   ```typescript
   "myCustomAction": async (page, step, context) => {
     // Your custom logic here
     console.log(`Executing custom action with data:`, step.data);
     // Use page object to interact with the browser
   }
   ```

2. **Use in your JSON scenario**:
   ```json
   {
     "stepName": "Execute my custom action",
     "action": "custom",
     "customName": "myCustomAction",
     "data": {
       "customParam": "value"
     }
   }
   ```

## 🚀 Running Tests

### Basic Test Execution

```bash
# Run all enabled tests
npm test

# Run with specific environment
ENV=staging npm test

# Run in headless mode
ENV=production npm test
```

### Advanced Options

```bash
# Run specific test file
npx playwright test tests/ui/runner.spec.ts

# Run with debug mode
npx playwright test --debug

# Generate and open report
npm test && npx playwright show-report
```

## 📊 Reports and Debugging

### HTML Reports

After test execution, view detailed reports:

```bash
npx playwright show-report
```

The report includes:
- Test execution timeline
- Screenshots of failures
- Network activity
- Console logs
- Performance metrics

### Debugging Failed Tests

1. **Enable debug mode**:
   ```bash
   npx playwright test --debug
   ```

2. **Add debugging steps in JSON**:
   ```json
   {
     "stepName": "Debug pause",
     "action": "waitForTimeout",
     "waitTime": 5000
   }
   ```

3. **Use soft assertions** for non-critical validations:
   ```json
   {
     "type": "toBeVisible",
     "selector": ".optional-element",
     "soft": true,
     "message": "Optional element check"
   }
   ```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Ensure tests pass before submitting

### Adding New Features

1. **New Actions**: Add to `ActionExecutor` class
2. **New Validations**: Add to `executeValidation` method
3. **New Selector Types**: Add to `getLocator` method
4. **Documentation**: Update README with examples

## 🐛 Troubleshooting

### Common Issues

**Issue: Tests fail with "TOKEN environment variable is not set"**
```bash
# Solution: Set TOKEN in your environment file
echo "TOKEN=your-token-here" >> configs/local.env
```

**Issue: Browser launch fails in CI**
```bash
# Solution: Install system dependencies
sudo npx playwright install-deps
```

**Issue: Element not found errors**
- Verify selector syntax and type
- Add explicit waits using `waitTime`
- Use different selector strategies (id, text, xpath)
- Enable debug mode to inspect elements

**Issue: Timeouts in slow environments**
- Increase timeout in `playwright.config.ts`
- Add more `waitTime` steps in scenarios
- Use `soft: true` for non-critical validations

### Debug Tips

1. **Enable verbose logging**:
   ```bash
   DEBUG=pw:api npm test
   ```

2. **Use browser developer tools**:
   - Set `headless: false` in config
   - Add long waits to inspect elements
   - Use `page.pause()` in custom actions

3. **Check network requests**:
   - Review network tab in HTML reports
   - Add network logging in custom actions

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👨‍💻 Authors & Contributors

- **Chella S** - *Initial work* - [AmChella](https://github.com/AmChella)

See also the list of [contributors](https://github.com/AmChella/configurable-test-suite/contributors) who participated in this project.

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) - Microsoft's powerful browser automation framework
- Inspired by the need for maintainable, code-free test automation
- Thanks to the open-source community for continuous feedback and contributions

---

**Happy Testing! 🎉**

For more examples and advanced usage, check out the `data/ui-scenarios/` directory in this repository.
