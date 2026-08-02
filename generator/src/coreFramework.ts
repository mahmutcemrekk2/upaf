export const STATE_STORE_TEMPLATE = `import { faker } from '@faker-js/faker';

export class StateStore {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map<string, any>();
  }

  set(key: string, value: any) {
    this.store.set(key, value);
  }

  get(key: string): any {
    return this.store.get(key);
  }

  resolve(template: string): string {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
      const trimmedPath = path.trim();
      
      // 1. Faker check
      if (trimmedPath.startsWith('$faker.')) {
        return this.resolveFaker(trimmedPath);
      }
      
      // 2. Regular variable check
      if (this.store.has(trimmedPath)) {
        const value = this.store.get(trimmedPath);
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
      
      return match; // return as is if not found
    });
  }

  resolveObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.resolve(obj);
    if (Array.isArray(obj)) return obj.map(item => this.resolveObject(item));
    if (typeof obj === 'object') {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        resolved[key] = this.resolveObject(val);
      }
      return resolved;
    }
    return obj;
  }

  private resolveFaker(path: string): string {
    const parts = path.split('.');
    let current: any = faker;
    
    for (let i = 1; i < parts.length; i++) {
      const key = parts[i];
      const methodMatch = key.match(/^(\\w+)(?:\\((.*)\\))?$/);
      
      if (methodMatch) {
        const methodName = methodMatch[1];
        const argsStr = methodMatch[2];
        
        if (typeof current[methodName] === 'function') {
          if (argsStr) {
            const args = argsStr.split(',').map(arg => {
              const trimmed = arg.trim();
              if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
              if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
              const num = Number(trimmed);
              return isNaN(num) ? trimmed : num;
            });
            current = current[methodName](...args);
          } else {
            current = current[methodName]();
          }
        } else {
          current = current[methodName];
        }
      } else {
        current = current[key];
      }
    }
    
    return String(current);
  }
}
`;

export const API_MANAGER_TEMPLATE = `import { APIRequestContext, expect } from '@playwright/test';
import { StateStore } from './StateStore';

export class ApiManager {
  private requestContext: APIRequestContext;
  private stateStore: StateStore;
  private defaultHeaders: Record<string, string> = {};

  constructor(requestContext: APIRequestContext, stateStore: StateStore) {
    this.requestContext = requestContext;
    this.stateStore = stateStore;
  }

  setDefaultHeaders(headers: Record<string, string>) {
    this.defaultHeaders = headers;
  }

  async sendRequest(config: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    body?: any;
    auth?: {
      type: string;
      token?: string;
      keyName?: string;
      placement?: string;
    };
  }) {
    // 1. Resolve URL, headers, and body using stateStore
    let resolvedUrl = this.stateStore.resolve(config.url);
    
    const resolvedHeaders: Record<string, string> = {};
    for (const [key, val] of Object.entries(this.defaultHeaders)) {
      resolvedHeaders[key] = this.stateStore.resolve(val);
    }

    if (config.headers) {
      for (const [key, val] of Object.entries(config.headers)) {
        resolvedHeaders[key] = this.stateStore.resolve(val);
      }
    }

    let resolvedBody = config.body;
    if (config.body) {
      if (typeof config.body === 'string') {
        resolvedBody = this.stateStore.resolve(config.body);
        try {
          resolvedBody = JSON.parse(resolvedBody);
        } catch (e) {
          // Keep as string if it isn't valid JSON
        }
      } else {
        resolvedBody = this.stateStore.resolveObject(config.body);
      }
    }

    // 2. Resolve authentication configuration
    if (config.auth && config.auth.type !== 'None') {
      const auth = config.auth;
      const tokenVal = auth.token ? this.stateStore.resolve(auth.token) : '';

      if (auth.type === 'Bearer') {
        resolvedHeaders['Authorization'] = \`Bearer \${tokenVal}\`;
      } else if (auth.type === 'ApiKey') {
        const key = auth.keyName || 'X-API-KEY';
        if (auth.placement === 'query') {
          const separator = resolvedUrl.includes('?') ? '&' : '?';
          resolvedUrl = \`\${resolvedUrl}\${separator}\${key}=\${encodeURIComponent(tokenVal)}\`;
        } else {
          resolvedHeaders[key] = tokenVal;
        }
      } else if (auth.type === 'Cookie') {
        resolvedHeaders['Cookie'] = tokenVal;
      }
    }

    const resolvedParams: Record<string, string> = {};
    if (config.params) {
      for (const [key, val] of Object.entries(config.params)) {
        resolvedParams[key] = this.stateStore.resolve(val);
      }
    }

    // 3. Perform request
    const response = await this.requestContext.fetch(resolvedUrl, {
      method: config.method,
      headers: resolvedHeaders,
      params: resolvedParams,
      data: resolvedBody
    });

    return response;
  }

  // Helper assertions
  async assertStatus(response: any, expectedStatus: number) {
    expect(response.status()).toBe(expectedStatus);
  }

  async assertContainsText(response: any, expectedText: string) {
    const text = await response.text();
    expect(text).toContain(expectedText);
  }

  async assertJsonEquals(response: any, path: string, expectedValue: any) {
    const body = await response.json();
    const actualValue = this.getValueByPath(body, path);
    const resolvedExpected = typeof expectedValue === 'string' 
      ? this.stateStore.resolve(expectedValue) 
      : this.stateStore.resolveObject(expectedValue);
    expect(actualValue).toEqual(resolvedExpected);
  }

  async assertSchema(response: any, schema: any, path: string = '$') {
    const body = await response.json();
    const actualValue = this.getValueByPath(body, path);

    const errors: string[] = [];
    const warnings: string[] = [];

    const walk = (act: any, exp: any, currentPath: string) => {
      if (exp === null || exp === undefined) return;
      if (act === null || act === undefined) return;

      const expType = Array.isArray(exp) ? 'array' : typeof exp;
      const actType = Array.isArray(act) ? 'array' : typeof act;

      if (actType !== expType) {
        errors.push('Type mismatch at ' + currentPath + ': Expected \'' + expType + '\', but got \'' + actType + '\'');
        return;
      }

      if (expType === 'object') {
        // Check for missing properties
        for (const key of Object.keys(exp)) {
          if (!(key in act)) {
            errors.push('Missing property \'' + key + '\' at ' + currentPath);
          } else {
            walk(act[key], exp[key], currentPath + '.' + key);
          }
        }

        // Check for extra properties
        for (const key of Object.keys(act)) {
          if (!(key in exp)) {
            warnings.push('Extra property \'' + key + '\' detected at ' + currentPath);
          }
        }
      } else if (expType === 'array') {
        if (exp.length > 0) {
          const itemTemplate = exp[0];
          act.forEach((item: any, idx: number) => {
            walk(item, itemTemplate, currentPath + '[' + idx + ']');
          });
        }
      }
    };

    if (actualValue === undefined) {
      errors.push('Target path \'' + path + '\' was not found in the response');
    } else {
      walk(actualValue, schema, path);
    }

    if (errors.length > 0 || warnings.length > 0) {
      let message = 'Schema Example Validation Failed:\\n';
      if (errors.length > 0) {
        message += 'Errors:\\n' + errors.map(err => '- ' + err).join('\\n') + '\\n';
      }
      if (warnings.length > 0) {
        message += 'Warnings (Extra Properties - Example needs update):\\n' + warnings.map(w => '- ' + w).join('\\n') + '\\n';
      }
      throw new Error(message);
    }
  }

  // Variable extraction helper
  async extractVariable(response: any, config: { variableName: string; path: string; source: 'body' | 'headers' }) {
    let value: any;
    if (config.source === 'headers') {
      value = response.headers()[config.path.toLowerCase()];
    } else {
      const body = await response.json();
      value = this.getValueByPath(body, config.path);
    }
    this.stateStore.set(config.variableName, value);
    return value;
  }

  private getValueByPath(obj: any, path: string): any {
    if (!path || path === '$' || path === 'body') return obj;
    let cleanPath = path.replace(/\[(\d+)\]/g, '.$1');
    cleanPath = cleanPath.replace(/^\$\.?/, '');
    if (cleanPath.startsWith('.')) {
      cleanPath = cleanPath.substring(1);
    }
    if (!cleanPath) return obj;

    const wildcardIndex = cleanPath.indexOf('[*]');
    if (wildcardIndex !== -1) {
      const leftPath = cleanPath.substring(0, wildcardIndex);
      let rightPath = cleanPath.substring(wildcardIndex + 3);
      if (rightPath.startsWith('.')) {
        rightPath = rightPath.substring(1);
      }
      
      const val = this.getValueByPath(obj, leftPath);
      if (Array.isArray(val)) {
        if (!rightPath) return val;
        return val.map(item => this.getValueByPath(item, rightPath));
      }
      return undefined;
    }

    return cleanPath.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}
`;

export const CORE_INDEX_TEMPLATE = `export * from './StateStore';
export * from './ApiManager';
`;
