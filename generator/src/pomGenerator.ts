import { LocatorInfo, TestSuite } from './models';
import { str, stepNeedsElement } from './utils';

/**
 * Extracts unique locators from a test suite to build the Page Object.
 */
function extractLocators(suite: TestSuite): LocatorInfo[] {
  const locators = new Map<string, LocatorInfo>();
  
  for (const testCase of suite.testCases) {
    for (const step of testCase.steps) {
      if (stepNeedsElement(step) && step.locator && step.locator.name) {
        if (!locators.has(step.locator.name)) {
          locators.set(step.locator.name, step.locator);
        }
      }
    }
  }
  
  return Array.from(locators.values());
}

/**
 * Maps a LocatorInfo object to a Playwright locator string.
 */
function buildLocatorString(locator: LocatorInfo): string {
  const value = locator.value || '';
  switch (locator.strategy) {
    case 'id':
      return `page.locator(${str(value.startsWith('#') ? value : `#${value}`)})`;
    case 'xpath':
      return `page.locator(${str(value.startsWith('xpath=') || value.startsWith('/') || value.startsWith('(') ? value : `xpath=${value}`)})`;
    case 'data-testid':
      return `page.getByTestId(${str(value)})`;
    case 'text':
      return `page.getByText(${str(value)})`;
    case 'role':
      return `page.getByRole(${str(value)} as any)`; // Simplify for now
    case 'css':
    default:
      return `page.locator(${str(value)})`;
  }
}

/**
 * Generates the source code for BasePage.ts
 */
export function generateBasePage(): string {
  return `import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(url: string) {
    await this.page.goto(url);
  }
}
`;
}

/**
 * Generates the source code for the specific Page Object Class.
 * e.g., AppHomePage.ts
 */
export function generatePageObject(className: string, suite: TestSuite): string {
  const locators = extractLocators(suite);
  
  let properties = '';
  let assignments = '';

  for (const loc of locators) {
    const locName = loc.name || 'unnamedLocator';
    properties += `  readonly ${locName}: Locator;\n`;
    assignments += `    this.${locName} = ${buildLocatorString(loc)};\n`;
  }

  return `import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ${className} extends BasePage {
${properties}
  constructor(page: Page) {
    super(page);
${assignments}  }
}
`;
}
