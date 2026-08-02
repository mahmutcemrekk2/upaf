import { TestSuite, TestCase, TestStep, ApiAssertion } from './models';

function generateAssertionCode(responseName: string, assertion: ApiAssertion): string {
  const targetStr = typeof assertion.target === 'string' ? `'${assertion.target}'` : 'undefined';
  const valStr = typeof assertion.value === 'object' ? JSON.stringify(assertion.value, null, 2).replace(/\n/g, '\n    ') : typeof assertion.value === 'string' ? `'${assertion.value}'` : assertion.value;

  switch (assertion.type) {
    case 'status':
      return `    await apiManager.assertStatus(${responseName}, ${assertion.value});\n`;
    case 'contains':
      return `    await apiManager.assertContainsText(${responseName}, '${assertion.value}');\n`;
    case 'equals':
      return `    await apiManager.assertJsonEquals(${responseName}, ${targetStr}, ${valStr});\n`;
    case 'jsonSchema':
      return `    await apiManager.assertSchema(${responseName}, ${valStr}, ${targetStr});\n`;
    default:
      return `    // Unknown assertion type: ${assertion.type}\n`;
  }
}

function generateStepCode(step: TestStep, index: number, pomInstanceName: string): string {
  let code = '';
  
  if (step.description) {
    code += `    // ${step.description}\n`;
  }

  if (step.action === 'apiRequest' && step.apiRequest) {
    const responseName = `response_${index}`;
    const req = step.apiRequest;
    
    const methodStr = `'${req.method}'`;
    const urlStr = `'${req.url}'`;
    
    const headersStr = req.headers ? `, headers: ${JSON.stringify(req.headers, null, 2).replace(/\n/g, '\n    ')}` : '';
    const paramsStr = req.params ? `, params: ${JSON.stringify(req.params, null, 2).replace(/\n/g, '\n    ')}` : '';
    const bodyStr = req.body ? `, body: ${JSON.stringify(req.body, null, 2).replace(/\n/g, '\n    ')}` : '';
    const authStr = req.auth ? `, auth: ${JSON.stringify(req.auth, null, 2).replace(/\n/g, '\n    ')}` : '';
    
    code += `    const ${responseName} = await apiManager.sendRequest({\n`;
    code += `      method: ${methodStr},\n`;
    code += `      url: ${urlStr}${headersStr}${paramsStr}${bodyStr}${authStr}\n`;
    code += `    });\n`;

    // Handle extractions
    if (req.extractions && req.extractions.length > 0) {
      for (const ext of req.extractions) {
        code += `    await apiManager.extractVariable(${responseName}, {\n`;
        code += `      variableName: '${ext.variableName}',\n`;
        code += `      path: '${ext.path}',\n`;
        code += `      source: '${ext.source || 'body'}'\n`;
        code += `    });\n`;
      }
    }

    // Handle assertions
    if (req.assertions && req.assertions.length > 0) {
      for (const assertion of req.assertions) {
        code += generateAssertionCode(responseName, assertion);
      }
    }
  } else {
    // UI step generation fallback
    const locName = step.locator?.name;
    const target = locName ? `${pomInstanceName}.${locName}` : 'page';

    switch (step.action) {
      case 'navigate':
        code += `    await ${pomInstanceName}.navigate('${step.value}');\n`;
        break;
      case 'click':
        code += `    await ${target}.click();\n`;
        break;
      case 'fill':
        code += `    await ${target}.fill('${step.value}');\n`;
        break;
      case 'check':
        code += `    await ${target}.check();\n`;
        break;
      case 'uncheck':
        code += `    await ${target}.uncheck();\n`;
        break;
      case 'select':
        code += `    await ${target}.selectOption('${step.value}');\n`;
        break;
      case 'waitForElement':
        code += `    await ${target}.waitFor({ state: 'visible' });\n`;
        break;
      case 'verifyText':
        code += `    await expect(${target}).toHaveText('${step.value}');\n`;
        break;
      case 'verifyVisible':
        code += `    await expect(${target}).toBeVisible();\n`;
        break;
      case 'custom': {
        const cleanVal = step.value?.trim() || '';
        const isGherkin = /^(Given|When|Then|And|But)\s+/i.test(cleanVal);
        if (isGherkin) {
          code += `    // Cucumber Step: ${cleanVal}\n`;
        } else {
          code += `    ${cleanVal}\n`;
        }
        break;
      }
      default:
        code += `    // Unknown action: ${step.action}\n`;
    }
  }

  return code;
}

export function generateSpecFile(suite: TestSuite, pomClassName: string): string {
  const pomInstanceName = pomClassName.charAt(0).toLowerCase() + pomClassName.slice(1);
  
  // Check if there are any API steps
  const hasApiSteps = suite.testCases.some(tc => tc.steps.some(step => step.action === 'apiRequest'));
  
  let specCode = `import { test, expect } from '@playwright/test';\n`;
  
  if (hasApiSteps) {
    specCode += `import { ApiManager, StateStore } from './core';\n`;
  }
  
  specCode += `import { ${pomClassName} } from './pages/${pomClassName}';\n\n`;
  
  specCode += `test.describe('${suite.title}', () => {\n`;
  
  if (hasApiSteps) {
    specCode += `  let stateStore: StateStore;\n`;
    specCode += `  let apiManager: ApiManager;\n`;
  }
  specCode += `  let ${pomInstanceName}: ${pomClassName};\n\n`;

  specCode += `  test.beforeEach(async ({ page, request }) => {\n`;
  if (hasApiSteps) {
    specCode += `    stateStore = new StateStore();\n`;
    specCode += `    apiManager = new ApiManager(request, stateStore);\n`;
    if (suite.defaultHeaders && Object.keys(suite.defaultHeaders).length > 0) {
      const formattedHeaders = JSON.stringify(suite.defaultHeaders, null, 6).replace(/\n/g, '\n    ');
      specCode += `    apiManager.setDefaultHeaders(${formattedHeaders.trim()});\n`;
    }
  }
  specCode += `    ${pomInstanceName} = new ${pomClassName}(page);\n`;
  specCode += `  });\n\n`;

  for (const testCase of suite.testCases) {
    specCode += `  test('${testCase.title}', async ({ page }) => {\n`;
    
    if (testCase.description) {
      specCode += `    // ${testCase.description}\n`;
    }

    for (let i = 0; i < testCase.steps.length; i++) {
      specCode += generateStepCode(testCase.steps[i], i, pomInstanceName);
    }
    
    specCode += `  });\n\n`;
  }

  specCode += `});\n`;
  return specCode;
}
