import { LocatorInfo, TestSuite } from './models';

/**
 * Extracts unique locators from a test suite to build the Page Object.
 */
function extractLocators(suite: TestSuite): LocatorInfo[] {
  const locators = new Map<string, LocatorInfo>();
  
  for (const testCase of suite.testCases) {
    for (const step of testCase.steps) {
      if (step.locator && step.locator.name) {
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
  switch (locator.strategy) {
    case 'id':
      return `page.locator('#${locator.value}')`;
    case 'css':
      return `page.locator('${locator.value}')`;
    case 'xpath':
      return `page.locator('${locator.value}')`;
    case 'data-testid':
      return `page.getByTestId('${locator.value}')`;
    case 'text':
      return `page.getByText('${locator.value}')`;
    case 'role':
      return `page.getByRole('${locator.value}' as any)`; // Simplify for now
    default:
      return `page.locator('${locator.value}')`;
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
