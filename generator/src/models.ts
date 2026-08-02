export type ActionType = 
  | 'navigate' 
  | 'click' 
  | 'fill' 
  | 'check' 
  | 'uncheck' 
  | 'select' 
  | 'waitForElement' 
  | 'verifyText' 
  | 'verifyVisible'
  | 'apiRequest';

export type LocatorStrategy = 
  | 'css' 
  | 'xpath' 
  | 'id' 
  | 'data-testid' 
  | 'text' 
  | 'role';

export interface LocatorInfo {
  strategy: LocatorStrategy;
  value: string;
  name?: string; // e.g., 'SubmitButton' -> for generating POM getter
}

// API Test Step Definitions
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthType = 'Bearer' | 'ApiKey' | 'Cookie' | 'None';

export interface AuthConfig {
  type: AuthType;
  token?: string; // Token value or template, e.g. '{{accessToken}}'
  keyName?: string; // For ApiKey, e.g. 'X-API-KEY'
  placement?: 'header' | 'query'; // For ApiKey
}

export interface DataExtraction {
  variableName: string; // e.g., 'userId'
  path: string; // e.g., 'data.id' or 'token'
  source: 'body' | 'headers';
}

export type AssertionType = 'status' | 'contains' | 'jsonSchema' | 'equals';

export interface ApiAssertion {
  type: AssertionType;
  target: 'status' | 'body' | 'headers' | string; // If string, interpreted as JSON path in body, e.g., 'user.email'
  value: any; // Expected value or schema definition, or template string
}

export interface ApiRequestInfo {
  method: HttpMethod;
  url: string; // e.g., '/api/users/{{userId}}'
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any; // String or JSON object, supports templates and faker expressions
  auth?: AuthConfig;
  extractions?: DataExtraction[];
  assertions?: ApiAssertion[];
}

export interface TestStep {
  id: string;
  action: ActionType;
  description?: string;
  // UI fields
  locator?: LocatorInfo;
  value?: string;
  // API fields
  apiRequest?: ApiRequestInfo;
}

export interface TestCase {
  id: string;
  title: string;
  description?: string;
  steps: TestStep[];
}

export interface TestSuite {
  id: string;
  title: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  testCases: TestCase[];
}
