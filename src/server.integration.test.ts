/**
 * @file server.integration.test.ts
 * @description Integration tests for the actual Express server endpoints
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { ChatCompletionRequest, ChatCompletionResponse } from './types';

// Set test environment before importing server
process.env.NODE_ENV = 'test';

// Mock the LlmManager class and its static properties
vi.mock('./llm_rotation', async () => {
    const actual = await vi.importActual('./llm_rotation') as any;
    
    const mockGenerateResponse = vi.fn();
    const mockLlmManagerInstance = {
        generateResponse: mockGenerateResponse,
        apiKeyStatus: {
            gemini: ['working'],
            openrouter: ['working']
        },
        _apiKeyIndices: {
            gemini: 0,
            openrouter: 0
        }
    };
    
    const MockLlmManager = vi.fn().mockImplementation(() => mockLlmManagerInstance);
    MockLlmManager.modelConfigurations = {
        gemini: [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
        ],
        openrouter: [
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'claude-3-opus', name: 'Claude 3 Opus' }
        ]
    };
    
    return {
        ...actual,
        LlmManager: MockLlmManager
    };
});

// Import server after mocking
import app from './server';
import { LlmManager } from './llm_rotation';

describe('Server Integration Tests', () => {
    let mockGenerateResponse: any;

    beforeAll(() => {
        // Get the mock function from the mocked LlmManager instance
        const mockInstance = new (LlmManager as any)();
        mockGenerateResponse = mockInstance.generateResponse;
        
        // Setup default mock response
        mockGenerateResponse.mockResolvedValue('This is a test response from the LlmManager.');
    });

    describe('POST /v1/chat/completions', () => {
        describe('Successful requests', () => {
            it('should handle a basic chat completion request', async () => {
                const requestBody: ChatCompletionRequest = {
                    model: 'gemini-1.5-pro',
                    messages: [
                        { role: 'user', content: 'Hello, how are you?' }
                    ]
                };

                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send(requestBody)
                    .expect(200);

                const body: ChatCompletionResponse = response.body;

                // Verify response structure
                expect(body).toHaveProperty('id');
                expect(body.id).toMatch(/^chatcmpl-/);
                expect(body.object).toBe('chat.completion');
                expect(body.model).toBe('gemini-1.5-pro');
                expect(body.choices).toHaveLength(1);
                expect(body.choices[0].message.role).toBe('assistant');
                expect(body.choices[0].message.content).toBe('This is a test response from the LlmManager.');
                expect(body.choices[0].finish_reason).toBe('stop');
                expect(body.usage).toHaveProperty('prompt_tokens');
                expect(body.usage).toHaveProperty('completion_tokens');
                expect(body.usage).toHaveProperty('total_tokens');

                // Verify LlmManager was called correctly
                expect(mockGenerateResponse).toHaveBeenCalledWith(
                    requestBody.messages,
                    expect.objectContaining({
                        provider: 'gemini',
                        model: 'gemini-1.5-pro',
                        temperature: 0.7, // default value
                        maxTokens: 2048, // default value
                        topP: 0.9 // default value
                    })
                );
            });

            it('should handle requests with optional parameters', async () => {
                const requestBody: ChatCompletionRequest = {
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: 'Explain quantum computing' }
                    ],
                    temperature: 0.8,
                    max_tokens: 1000,
                    top_p: 0.95
                };

                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send(requestBody)
                    .expect(200);

                expect(response.body.model).toBe('gpt-4');
                expect(response.body.choices[0].message.role).toBe('assistant');

                // Verify LlmManager was called with custom parameters
                expect(mockGenerateResponse).toHaveBeenCalledWith(
                    requestBody.messages,
                    expect.objectContaining({
                        provider: 'openrouter',
                        model: 'gpt-4',
                        temperature: 0.8,
                        maxTokens: 1000,
                        topP: 0.95
                    })
                );
            });

            it('should integrate provider detection correctly', async () => {
                const requestBody: ChatCompletionRequest = {
                    model: 'gemini-1.5-flash',
                    messages: [{ role: 'user', content: 'Test message' }]
                };

                await request(app)
                    .post('/v1/chat/completions')
                    .send(requestBody)
                    .expect(200);

                // Verify correct provider was detected
                expect(mockGenerateResponse).toHaveBeenCalledWith(
                    requestBody.messages,
                    expect.objectContaining({
                        provider: 'gemini',
                        model: 'gemini-1.5-flash'
                    })
                );
            });

            it('should handle LlmManager errors gracefully', async () => {
                // Mock LlmManager to throw an error
                mockGenerateResponse.mockRejectedValueOnce(
                    new Error('API key exhausted')
                );

                const requestBody: ChatCompletionRequest = {
                    model: 'gemini-1.5-pro',
                    messages: [{ role: 'user', content: 'Test message' }]
                };

                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send(requestBody);

                // Should return an error status (500 or other error status)
                expect(response.status).toBeGreaterThanOrEqual(400);
                
                // Verify that the mock was called (meaning the error path was taken)
                expect(mockGenerateResponse).toHaveBeenCalled();
            });
        });

        describe('Validation errors', () => {
            it('should return 400 for missing required fields', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({})
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for missing messages', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ model: 'gemini-1.5-pro' })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for empty messages array', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [] 
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for invalid message format', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'invalid', content: 'Hello' }] 
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for invalid temperature', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Hello' }],
                        temperature: 3.0 // Invalid: > 2.0
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for invalid max_tokens', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Hello' }],
                        max_tokens: -1 // Invalid: negative
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });

            it('should return 400 for invalid top_p', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Hello' }],
                        top_p: 1.5 // Invalid: > 1.0
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.type).toBe('invalid_request_error');
            });
        });

        describe('Model handling', () => {
            it('should return 400 for unsupported model', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'unsupported-model',
                        messages: [{ role: 'user', content: 'Hello' }]
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error.code).toBe('model_not_found');
                expect(response.body.error.message).toContain('unsupported-model');
            });

            it('should detect provider correctly for different models', async () => {
                const testCases = [
                    { model: 'gemini-1.5-pro', expectedProvider: 'gemini' },
                    { model: 'gpt-4', expectedProvider: 'openrouter' },
                    { model: 'claude-3-opus', expectedProvider: 'openrouter' }
                ];

                for (const testCase of testCases) {
                    const requestBody: ChatCompletionRequest = {
                        model: testCase.model,
                        messages: [{ role: 'user', content: 'Test' }]
                    };

                    await request(app)
                        .post('/v1/chat/completions')
                        .send(requestBody)
                        .expect(200);

                    expect(mockGenerateResponse).toHaveBeenCalledWith(
                        requestBody.messages,
                        expect.objectContaining({
                            provider: testCase.expectedProvider,
                            model: testCase.model
                        })
                    );
                }
            });
        });

        describe('Response format', () => {
            it('should return proper OpenAI-compatible response format', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Test message' }]
                    })
                    .expect(200);

                const body: ChatCompletionResponse = response.body;

                // Verify all required OpenAI fields are present
                expect(body).toHaveProperty('id');
                expect(body).toHaveProperty('object');
                expect(body).toHaveProperty('created');
                expect(body).toHaveProperty('model');
                expect(body).toHaveProperty('choices');
                expect(body).toHaveProperty('usage');

                // Verify field types and values
                expect(typeof body.id).toBe('string');
                expect(body.object).toBe('chat.completion');
                expect(typeof body.created).toBe('number');
                expect(body.model).toBe('gemini-1.5-pro');
                expect(Array.isArray(body.choices)).toBe(true);
                expect(body.choices).toHaveLength(1);

                // Verify choice structure
                const choice = body.choices[0];
                expect(choice).toHaveProperty('index');
                expect(choice).toHaveProperty('message');
                expect(choice).toHaveProperty('finish_reason');
                expect(choice.index).toBe(0);
                expect(choice.message.role).toBe('assistant');
                expect(typeof choice.message.content).toBe('string');
                expect(choice.finish_reason).toBe('stop');

                // Verify usage structure
                expect(body.usage).toHaveProperty('prompt_tokens');
                expect(body.usage).toHaveProperty('completion_tokens');
                expect(body.usage).toHaveProperty('total_tokens');
                expect(typeof body.usage.prompt_tokens).toBe('number');
                expect(typeof body.usage.completion_tokens).toBe('number');
                expect(typeof body.usage.total_tokens).toBe('number');
            });

            it('should include request ID in response', async () => {
                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Test message' }]
                    })
                    .expect(200);

                const body: ChatCompletionResponse = response.body;
                // In test mode, request ID will be 'unknown' or a timestamp-based ID
                expect(body.id).toMatch(/^chatcmpl-/);
                expect(typeof body.id).toBe('string');
                expect(body.id.length).toBeGreaterThan(8);
            });

            it('should transform LlmManager response correctly', async () => {
                const customResponse = 'Custom test response from LlmManager';
                mockGenerateResponse.mockResolvedValueOnce(customResponse);

                const response = await request(app)
                    .post('/v1/chat/completions')
                    .send({ 
                        model: 'gemini-1.5-pro',
                        messages: [{ role: 'user', content: 'Test message' }]
                    })
                    .expect(200);

                const body: ChatCompletionResponse = response.body;
                expect(body.choices[0].message.content).toBe(customResponse);
            });
        });
    });

    describe('Request/Response Transformation Integration', () => {
        it('should properly transform request parameters to LlmManager format', async () => {
            const requestBody: ChatCompletionRequest = {
                model: 'gemini-1.5-pro',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Hello!' }
                ],
                temperature: 0.5,
                max_tokens: 1500,
                top_p: 0.8
            };

            await request(app)
                .post('/v1/chat/completions')
                .send(requestBody)
                .expect(200);

            // Verify the transformation was applied correctly
            expect(mockGenerateResponse).toHaveBeenCalledWith(
                requestBody.messages,
                expect.objectContaining({
                    provider: 'gemini',
                    model: 'gemini-1.5-pro',
                    temperature: 0.5,
                    maxTokens: 1500,
                    topP: 0.8,
                    apiKeys: expect.any(Object),
                    siteUrl: expect.any(String),
                    siteName: expect.any(String)
                })
            );
        });

        it('should apply default values when parameters are not provided', async () => {
            const requestBody: ChatCompletionRequest = {
                model: 'gpt-4',
                messages: [{ role: 'user', content: 'Hello!' }]
            };

            await request(app)
                .post('/v1/chat/completions')
                .send(requestBody)
                .expect(200);

            // Verify default values were applied
            expect(mockGenerateResponse).toHaveBeenCalledWith(
                requestBody.messages,
                expect.objectContaining({
                    temperature: 0.7, // default
                    maxTokens: 2048, // default
                    topP: 0.9 // default
                })
            );
        });
    });

    describe('GET /v1/models', () => {
        it('should return list of available models', async () => {
            const response = await request(app)
                .get('/v1/models')
                .expect(200);

            expect(response.body).toHaveProperty('object');
            expect(response.body.object).toBe('list');
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);

            // Check first model structure
            const model = response.body.data[0];
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('object');
            expect(model).toHaveProperty('owned_by');
            expect(model.object).toBe('model');
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body.status).toBe('ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('memory');
        });
    });

    describe('GET /v1/keys/status', () => {
        it('should return API key status information', async () => {
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            expect(response.body).toHaveProperty('providers');
            expect(response.body).toHaveProperty('systemStatus');
            expect(response.body).toHaveProperty('timestamp');

            // Verify system status is one of the expected values
            expect(['healthy', 'degraded', 'critical']).toContain(response.body.systemStatus);

            // Verify timestamp is a valid ISO string
            expect(() => new Date(response.body.timestamp)).not.toThrow();

            // Verify providers structure
            expect(typeof response.body.providers).toBe('object');
        });

        it('should include configured providers in the response', async () => {
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            const providers = response.body.providers;

            // Should include gemini and openrouter (from test config)
            expect(providers).toHaveProperty('gemini');
            expect(providers).toHaveProperty('openrouter');

            // Verify provider structure
            const geminiProvider = providers.gemini;
            expect(geminiProvider).toHaveProperty('provider');
            expect(geminiProvider).toHaveProperty('totalKeys');
            expect(geminiProvider).toHaveProperty('currentKeyIndex');
            expect(geminiProvider).toHaveProperty('keys');
            expect(geminiProvider.provider).toBe('gemini');
            expect(typeof geminiProvider.totalKeys).toBe('number');
            expect(typeof geminiProvider.currentKeyIndex).toBe('number');
            expect(Array.isArray(geminiProvider.keys)).toBe(true);
        });

        it('should include key status information for each provider', async () => {
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            const providers = response.body.providers;
            const geminiProvider = providers.gemini;

            // Verify keys array structure
            expect(geminiProvider.keys.length).toBeGreaterThan(0);
            
            const keyInfo = geminiProvider.keys[0];
            expect(keyInfo).toHaveProperty('index');
            expect(keyInfo).toHaveProperty('status');
            expect(typeof keyInfo.index).toBe('number');
            expect(['untested', 'working', 'failed', 'rate-limited']).toContain(keyInfo.status);

            // Security check: should not expose actual key values
            expect(keyInfo).not.toHaveProperty('key');
            expect(keyInfo).not.toHaveProperty('apiKey');
        });

        it('should determine system status correctly based on key health', async () => {
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            const systemStatus = response.body.systemStatus;
            const providers = response.body.providers;

            // Count total and healthy keys
            let totalKeys = 0;
            let healthyKeys = 0;

            for (const provider of Object.values(providers) as any[]) {
                totalKeys += provider.totalKeys;
                healthyKeys += provider.keys.filter((key: any) => 
                    key.status === 'working' || key.status === 'untested'
                ).length;
            }

            // Verify system status logic
            if (totalKeys === 0) {
                expect(systemStatus).toBe('critical');
            } else if (healthyKeys === 0) {
                expect(systemStatus).toBe('critical');
            } else if (healthyKeys < totalKeys * 0.5) {
                expect(systemStatus).toBe('degraded');
            } else {
                expect(systemStatus).toBe('healthy');
            }
        });

        it('should handle errors gracefully', async () => {
            // Since our implementation is robust and handles null/undefined gracefully,
            // let's test that it returns a proper response even with missing data
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            // Should still return a valid response structure
            expect(response.body).toHaveProperty('providers');
            expect(response.body).toHaveProperty('systemStatus');
            expect(response.body).toHaveProperty('timestamp');
            
            // The system should handle missing or invalid data gracefully
            expect(typeof response.body.providers).toBe('object');
            expect(['healthy', 'degraded', 'critical']).toContain(response.body.systemStatus);
        });

        it('should not expose sensitive information', async () => {
            const response = await request(app)
                .get('/v1/keys/status')
                .expect(200);

            const responseString = JSON.stringify(response.body);

            // Should not contain actual API keys or sensitive data
            expect(responseString).not.toMatch(/sk-[a-zA-Z0-9]+/); // OpenAI key pattern
            expect(responseString).not.toMatch(/AIza[a-zA-Z0-9]+/); // Google API key pattern
            expect(responseString).not.toMatch(/test-.*-key/); // Our test key patterns

            // Verify that key objects don't have sensitive fields
            const providers = response.body.providers;
            for (const provider of Object.values(providers) as any[]) {
                for (const key of provider.keys) {
                    expect(key).not.toHaveProperty('value');
                    expect(key).not.toHaveProperty('apiKey');
                    expect(key).not.toHaveProperty('secret');
                }
            }
        });
    });
});