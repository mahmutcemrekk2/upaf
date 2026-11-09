import { TestSuite, TestStep, LocatorInfo } from './models';

/**
 * Serializes any value into a safe TypeScript string literal.
 * Handles quotes, backslashes, newlines and unicode.
 */
export function str(value: unknown): string {
  return JSON.stringify(value === undefined || value === null ? '' : String(value));
}

/** Escapes text placed inside a single-line `//` comment. */
export function comment(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

const TR_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
  'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U',
};

const RESERVED = new Set(['page', 'navigate', 'constructor']);

/** Replaces Turkish characters with their ASCII equivalents. */
export function transliterate(raw: string): string {
  return raw.split('').map(ch => TR_MAP[ch] ?? ch).join('');
}

/**
 * Converts arbitrary text into a camelCase TS identifier, keeping existing
 * inner casing (e.g. `loanAmountInput` stays as is). Returns '' if nothing usable remains.
 */
export function toIdentifier(raw: string): string {
  const words = transliterate(raw)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => (w === w.toUpperCase() ? w.toLowerCase() : w));
  if (words.length === 0) return '';

  let id = words[0].charAt(0).toLowerCase() + words[0].slice(1);
  for (const w of words.slice(1)) {
    id += w.charAt(0).toUpperCase() + w.slice(1);
  }
  if (/^[0-9]/.test(id)) id = `el${id.charAt(0).toUpperCase()}${id.slice(1)}`;
  if (RESERVED.has(id)) id = `${id}Element`;
  return id;
}

/** Derives a readable element name from a selector, e.g. `[data-testid="login-btn"]` -> `loginBtn`. */
export function deriveNameFromSelector(locator: LocatorInfo): string {
  const value = locator.value || '';
  const patterns = [
    /data-testid=["']([^"']+)["']/,
    /has-text\(\s*["']([^"']+)["']\s*\)/,
    /^text=["']?([^"']+)["']?$/,
    /\[name=["']([^"']+)["']\]/,
    /\[placeholder=["']([^"']+)["']\]/,
    /\[aria-label=["']([^"']+)["']\]/,
    /#([a-zA-Z][\w-]*)/,
    /\.([a-zA-Z][\w-]*)/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) {
      const id = toIdentifier(m[1]);
      if (id) return id;
    }
  }
  return toIdentifier(value) || 'element';
}

const STEPS_WITH_ELEMENT = new Set([
  'click', 'fill', 'check', 'uncheck', 'select',
  'waitForElement', 'verifyText', 'verifyVisible', 'verifyValue',
]);

export function stepNeedsElement(step: TestStep): boolean {
  return STEPS_WITH_ELEMENT.has(step.action) && !!step.locator?.value;
}

/**
 * Returns a copy of the suite where every element-based UI step has a valid,
 * unique POM property name. Steps sharing the same selector share the same name;
 * different selectors with a colliding name get a numeric suffix.
 */
export function normalizeSuite(suite: TestSuite): TestSuite {
  const nameBySelector = new Map<string, string>();
  const selectorByName = new Map<string, string>();

  const assign = (locator: LocatorInfo): string => {
    const key = `${locator.strategy || 'css'}::${locator.value}`;
    const existing = nameBySelector.get(key);
    if (existing) return existing;

    const userName = hasUserName(locator) ? toIdentifier(locator.name!) : '';
    const base = userName || deriveNameFromSelector(locator);

    let name = base;
    let n = 2;
    while (selectorByName.has(name) && selectorByName.get(name) !== key) {
      name = `${base}${n++}`;
    }
    nameBySelector.set(key, name);
    selectorByName.set(name, key);
    return name;
  };

  const hasUserName = (l: LocatorInfo) => !!l.name && l.name !== 'NaN' && l.name !== 'undefined';
  const elementSteps = suite.testCases.flatMap(tc => tc.steps).filter(stepNeedsElement);

  // Pass 1: user-provided names win. Pass 2: derive names for the rest.
  for (const step of elementSteps) if (hasUserName(step.locator!)) assign(step.locator!);
  for (const step of elementSteps) if (!hasUserName(step.locator!)) assign(step.locator!);

  return {
    ...suite,
    testCases: suite.testCases.map(tc => ({
      ...tc,
      steps: tc.steps.map(step => {
        if (!stepNeedsElement(step) || !step.locator) return step;
        const locator = { ...step.locator, strategy: step.locator.strategy || 'css' };
        return { ...step, locator: { ...locator, name: assign(locator) } };
      }),
    })),
  };
}
