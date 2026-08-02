import { TestSuite } from './models';
import { generatePlaywrightProject } from './index';

const dummySuite: TestSuite = {
  id: 'suite_api_1',
  title: 'User Management API Flow',
  baseUrl: 'https://api.example.com',
  testCases: [
    {
      id: 'tc_api_auth_and_create',
      title: 'Auth and Create User',
      description: 'Authenticate, extract token, create user with Faker data, and verify',
      steps: [
        {
          id: 'step_1',
          action: 'apiRequest',
          description: 'Authenticate and obtain token',
          apiRequest: {
            method: 'POST',
            url: '/api/auth/login',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              client_id: 'upaf-agent',
              client_secret: 'secret-123'
            },
            extractions: [
              {
                variableName: 'accessToken',
                path: 'token',
                source: 'body'
              }
            ],
            assertions: [
              {
                type: 'status',
                target: 'status',
                value: 200
              },
              {
                type: 'equals',
                target: 'authenticated',
                value: true
              }
            ]
          }
        },
        {
          id: 'step_2',
          action: 'apiRequest',
          description: 'Create user with dynamic Faker data',
          apiRequest: {
            method: 'POST',
            url: '/api/users',
            auth: {
              type: 'Bearer',
              token: '{{accessToken}}'
            },
            body: {
              email: '{{$faker.internet.email}}',
              name: '{{$faker.person.fullName}}',
              role: 'user'
            },
            extractions: [
              {
                variableName: 'createdUserId',
                path: 'id',
                source: 'body'
              }
            ],
            assertions: [
              {
                type: 'status',
                target: 'status',
                value: 201
              },
              {
                type: 'contains',
                target: 'body',
                value: 'User successfully created'
              }
            ]
          }
        },
        {
          id: 'step_3',
          action: 'apiRequest',
          description: 'Get created user details',
          apiRequest: {
            method: 'GET',
            url: '/api/users/{{createdUserId}}',
            auth: {
              type: 'Bearer',
              token: '{{accessToken}}'
            },
            assertions: [
              {
                type: 'status',
                target: 'status',
                value: 200
              },
              {
                type: 'jsonSchema',
                target: 'body',
                value: {
                  type: 'object',
                  required: ['id', 'email', 'name', 'role'],
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string' }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  ]
};

const output = generatePlaywrightProject(dummySuite);

console.log('--- GENERATED UPAF PROJECT FILES ---');
for (const file of output) {
  console.log(`\n\n=== FILE: ${file.filename} ===`);
  console.log(file.content);
}
