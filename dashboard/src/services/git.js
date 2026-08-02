import { generatePlaywrightProject } from 'generator';

const parseHeaders = (headersStr) => {
  if (!headersStr) return {};
  const trimmed = headersStr.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // JSON parsing failed, fallback to line-based parsing
    }
  }

  const headers = {};
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(/^([^:=]+)[:=](.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      headers[key] = val;
    }
  }
  return headers;
};

export const gitService = {
  /**
   * Pushes the generated code to the specified GitHub repository.
   * Uses the GitHub REST API.
   */
  async pushToGitHub(project, testCase, steps, selectedAuthMethod = null) {
    const { git_repo_url, git_branch, git_token } = project;
    
    if (!git_repo_url || !git_token) {
      throw new Error('Git configuration missing. Please update project settings.');
    }

    // 1. Prepare the data for the generator
    // Group consecutive assertion/extraction steps into the preceding apiRequest step
    const groupedSteps = [];
    let lastApiStep = null;

    for (const s of steps) {
      if (['get', 'post', 'put', 'delete'].includes(s.action)) {
        const apiHeaders = parseHeaders(s.headers);
        if (s.authMethod) {
          const methodConfig = project.auth_methods?.find(a => a.name === s.authMethod);
          if (methodConfig) {
            let authHeaderName = 'Authorization';
            let authToken = `Bearer <${methodConfig.name}>`;
            if (methodConfig.usageType === 'Cookie') {
              authHeaderName = 'Cookie';
              authToken = `access_token=<${methodConfig.name}>`;
            } else if (methodConfig.usageType === 'CustomHeader') {
              authHeaderName = methodConfig.headerName || 'X-Auth-Token';
              authToken = `<${methodConfig.name}>`;
            }

            const hasCustomAuth = Object.keys(apiHeaders).some(
              k => k.toLowerCase() === authHeaderName.toLowerCase()
            );
            if (!hasCustomAuth) {
              apiHeaders[authHeaderName] = authToken;
            }
          }
        }

        const apiReq = {
          method: s.action.toUpperCase(),
          url: s.locator?.value || '/',
          headers: apiHeaders,
          params: parseHeaders(s.params),
          body: s.value,
          extractions: [],
          assertions: []
        };
        
        lastApiStep = {
          id: s.id,
          action: 'apiRequest',
          description: s.description,
          apiRequest: apiReq
        };
        groupedSteps.push(lastApiStep);
      } else if (['verifyStatus', 'verifyBody', 'verifySchema', 'extractData'].includes(s.action) && lastApiStep) {
        const apiReq = lastApiStep.apiRequest;
        if (s.action === 'verifyStatus') {
          apiReq.assertions.push({
            type: 'status',
            target: 'status',
            value: parseInt(s.value) || 200
          });
        } else if (s.action === 'verifyBody') {
          apiReq.assertions.push({
            type: 'equals',
            target: s.locator?.value || 'body',
            value: s.value
          });
        } else if (s.action === 'verifySchema') {
          let parsedSchema = {};
          try {
            parsedSchema = JSON.parse(s.value || '{}');
          } catch (e) {
            parsedSchema = s.value;
          }
          apiReq.assertions.push({
            type: 'jsonSchema',
            target: s.locator?.value || '$',
            value: parsedSchema
          });
        } else if (s.action === 'extractData') {
          apiReq.extractions.push({
            variableName: s.value?.replace(/\s+/g, '_') || 'extracted_var',
            path: s.locator?.value || 'id',
            source: 'body'
          });
        }
      } else {
        // Keep other steps (like UI actions) as they are
        groupedSteps.push(s);
      }
    }

    let defaultHeaders = parseHeaders(project.environments?.[0]?.headers || '');

    const suite = {
      title: testCase.name || 'Untitled Suite',
      baseUrl: project.environments?.[0]?.url || 'http://localhost:3000',
      defaultHeaders: defaultHeaders,
      testCases: [
        {
          title: testCase.name,
          steps: groupedSteps
        }
      ]
    };

    const isJavaCucumber = steps.some(s => s.action === 'custom' && /^(Given|When|Then|And|But)\s+/i.test(s.value?.trim()));
    
    const filesToUpload = [];
    
    if (isJavaCucumber) {
      const featureFileName = `src/test/resources/features/${testCase.name.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase()}.feature`;
      
      let featureContent = `@smoke\nFeature: ${project.name || 'API Test Suite'}\n  Auto-generated test scenario from UPAF\n\n`;
      featureContent += `  @smoke\n  Scenario: ${testCase.name}\n`;
      
      steps.forEach(step => {
        if (step.action === 'custom') {
          featureContent += `    ${step.value.trim()}\n`;
        } else {
          if (step.authMethod) {
            featureContent += `    Given system is authenticated with "${step.authMethod}"\n`;
          }
          if (step.action === 'get') {
            featureContent += `    When system sends "GET" request to "${step.locator?.value || '/'}"\n`;
          } else if (step.action === 'post') {
            if (step.value) {
              featureContent += `    When system sends "POST" request to "${step.locator?.value || '/'}" with body:\n    """\n    ${step.value}\n    """\n`;
            } else {
              featureContent += `    When system sends "POST" request to "${step.locator?.value || '/'}"\n`;
            }
          } else if (step.action === 'put') {
            if (step.value) {
              featureContent += `    When system sends "PUT" request to "${step.locator?.value || '/'}" with body:\n    """\n    ${step.value}\n    """\n`;
            } else {
              featureContent += `    When system sends "PUT" request to "${step.locator?.value || '/'}"\n`;
            }
          } else if (step.action === 'delete') {
            featureContent += `    When system sends "DELETE" request to "${step.locator?.value || '/'}"\n`;
          } else if (step.action === 'verifyStatus') {
            featureContent += `    Then response status code should be ${step.value || 200}\n`;
          } else if (step.action === 'verifyBody') {
            const isNum = !isNaN(step.value) && step.value.trim() !== '';
            if (isNum) {
              featureContent += `    Then response "${step.locator?.value || '$'}" should be ${parseInt(step.value)}\n`;
            } else {
              featureContent += `    Then response "${step.locator?.value || '$'}" should be "${step.value}"\n`;
            }
          } else if (step.action === 'verifySchema') {
            featureContent += `    Then response "${step.locator?.value || '$'}" should match schema:\n    """\n    ${step.value}\n    """\n`;
          } else if (step.action === 'extractData') {
            featureContent += `    And system stores response "${step.locator?.value || '$'}" as "${step.value}"\n`;
          }
        }
      });
      
      filesToUpload.push({
        filename: featureFileName,
        content: featureContent
      });
    } else {
      const generatedFiles = generatePlaywrightProject(suite);
      filesToUpload.push(...generatedFiles);
    }

    const results = [];
    for (const file of filesToUpload) {
      try {
        const result = await this.uploadFileToGitHub(
          git_repo_url,
          file.filename,
          file.content,
          git_token,
          git_branch || 'main'
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.filename}:`, error);
        throw new Error(`Failed to upload ${file.filename}: ${error.message}`);
      }
    }

    return results;
  },

  async uploadFileToGitHub(repo, path, content, token, branch) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    // 1. Check if file exists to get the SHA (required for updates)
    let sha = null;
    try {
      const getRes = await fetch(`${url}?ref=${branch}`, {
        headers: { 'Authorization': `token ${token}` }
      });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (e) {
      // File probably doesn't exist, which is fine for first push
    }

    // 2. Create or Update the file
    const body = {
      message: `UPAF Auto-Sync: Updated ${path}`,
      content: btoa(unescape(encodeURIComponent(content))), // Base64 encoding
      branch: branch
    };

    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'GitHub API error');
    }

    return await res.json();
  }
};
