/**
 * @file transformations.test.ts
 * @description Comprehensive unit tests for request/response transformation utilities
 */

import { describe, it, expect } from 'vitest';
import {
    transformRequest,
    transformResponse,
    estimateTokens,
    estimateTokensWithRoles,
    createStreamingTransformer,
    validateTransformationRequest,
    transformError
} from './transformations';
import type { ChatCompletionRequest, Message, ApiKeys } from './types';

describe('transformRequest', () => {
    const mockApiKeys: ApiKeys = {
        openrouter: ['key1', 'key2'],
        gemini: 'single-key'
    };

    const defaultSettings = {
        temperature: 0.8,
        maxTokens: 1024,
        topP: 0.95,
        siteUrl: 'https://example.com',
        siteName: 'Test App'
    };

    it('should transform basic OpenAI request to LlmManager format', () => {
        const openaiRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Hello, world!' }
            ]
        };

        const result = transformRequest(openaiRequest, 'openrouter', mockApiKeys);

        expect(result).toEqual({
            provider: 'openrouter',
            model: 'gpt-4',
            apiKeys: mockApiKeys,
            temperature: 0.7, // default
            maxTokens: 2048, // default
            topP: 0.9, // default
            siteUrl: 'http://localhost:3000', // default
            siteName: 'LLM Rotation Server' // default
        });
    });

    it('should use provided parameters over defaults', () => {
        const openaiRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.5,
            max_tokens: 512,
            top_p: 0.8
        };

        const result = transformRequest(openaiRequest, 'openrouter', mockApiKeys, defaultSettings);

        expect(result.temperature).toBe(0.5);
        expect(result.maxTokens).toBe(512);
        expect(result.topP).toBe(0.8);
        expect(result.siteUrl).toBe('https://example.com');
        expect(result.siteName).toBe('Test App');
    });

    it('should use default settings when provided', () => {
        const openaiRequest: ChatCompletionRequest = {
            model: 'gemini-pro',
            messages: [{ role: 'user', content: 'Test' }]
        };

        const result = transformRequest(openaiRequest, 'gemini', mockApiKeys, defaultSettings);

        expect(result.temperature).toBe(0.8);
        expect(result.maxTokens).toBe(1024);
        expect(result.topP).toBe(0.95);
        expect(result.siteUrl).toBe('https://example.com');
        expect(result.siteName).toBe('Test App');
    });

    it('should handle different providers correctly', () => {
        const openaiRequest: ChatCompletionRequest = {
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: 'Test' }]
        };

        const result = transformRequest(openaiRequest, 'gemini', mockApiKeys);

        expect(result.provider).toBe('gemini');
        expect(result.model).toBe('gemini-2.0-flash');
        expect(result.apiKeys).toBe(mockApiKeys);
    });
});

describe('transformResponse', () => {
    const mockMessages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
    ];

    it('should transform basic response correctly', () => {
        const content = 'The answer is 4.';
        const model = 'gpt-4';
        
        const result = transformResponse(content, model, mockMessages);

        expect(result.object).toBe('chat.completion');
        expect(result.model).toBe(model);
        expect(result.choices).toHaveLength(1);
        expect(result.choices[0].message.role).toBe('assistant');
        expect(result.choices[0].message.content).toBe(content);
        expect(result.choices[0].finish_reason).toBe('stop');
        expect(result.choices[0].index).toBe(0);
        expect(result.usage.total_tokens).toBeGreaterThan(0);
        expect(result.created).toBeGreaterThan(0);
        expect(result.id).toMatch(/^chatcmpl-/);
    });

    it('should use provided request ID', () => {
        const requestId = 'test-request-123';
        const result = transformResponse('Hello', 'gpt-4', mockMessages, requestId);

        expect(result.id).toBe(`chatcmpl-${requestId}`);
    });

    it('should calculate usage tokens correctly', () => {
        const content = 'This is a longer response with more words to test token calculation.';
        const result = transformResponse(content, 'gpt-4', mockMessages);

        expect(result.usage.prompt_tokens).toBeGreaterThan(0);
        expect(result.usage.completion_tokens).toBeGreaterThan(0);
        expect(result.usage.total_tokens).toBe(
            result.usage.prompt_tokens + result.usage.completion_tokens
        );
    });

    it('should handle empty content', () => {
        const result = transformResponse('', 'gpt-4', mockMessages);

        expect(result.choices[0].message.content).toBe('');
        expect(result.usage.completion_tokens).toBe(0); // Empty content should have 0 tokens
    });
});

describe('estimateTokens', () => {
    it('should estimate tokens for simple strings', () => {
        expect(estimateTokens('hello')).toBeGreaterThan(0);
        expect(estimateTokens('hello world')).toBeGreaterThan(estimateTokens('hello'));
        expect(estimateTokens('')).toBe(0);
    });

    it('should handle single messages', () => {
        const message: Message = { role: 'user', content: 'Hello, how are you?' };
        const tokens = estimateTokens(message);
        
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBe(estimateTokens(message.content));
    });

    it('should handle message arrays', () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'What is AI?' }
        ];
        
        const tokens = estimateTokens(messages);
        const combinedContent = messages.map(m => m.content).join(' ');
        
        expect(tokens).toBe(estimateTokens(combinedContent));
        expect(tokens).toBeGreaterThan(0);
    });

    it('should handle different word lengths appropriately', () => {
        // Short words should be fewer tokens
        const shortText = 'a b c d';
        const longText = 'supercalifragilisticexpialidocious antidisestablishmentarianism';
        
        const shortTokens = estimateTokens(shortText);
        const longTokens = estimateTokens(longText);
        
        expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should handle special characters', () => {
        const textWithSpecialChars = 'Hello! How are you? I\'m fine. (Thanks for asking)';
        const tokens = estimateTokens(textWithSpecialChars);
        
        expect(tokens).toBeGreaterThan(0);
    });

    it('should handle whitespace normalization', () => {
        const normalText = 'hello world';
        const spacedText = '  hello    world  ';
        
        expect(estimateTokens(normalText)).toBe(estimateTokens(spacedText));
    });

    it('should return minimum 1 token for non-empty text', () => {
        expect(estimateTokens('a')).toBe(1);
        expect(estimateTokens('!')).toBe(1);
        expect(estimateTokens(' ')).toBe(0); // Only whitespace should be 0
    });
});

describe('estimateTokensWithRoles', () => {
    it('should add role overhead to token estimates', () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello' }
        ];
        
        const basicTokens = estimateTokens(messages);
        const roleTokens = estimateTokensWithRoles(messages);
        
        expect(roleTokens).toBeGreaterThan(basicTokens);
    });

    it('should handle different roles with appropriate overhead', () => {
        const systemMessage: Message[] = [{ role: 'system', content: 'test' }];
        const userMessage: Message[] = [{ role: 'user', content: 'test' }];
        const assistantMessage: Message[] = [{ role: 'assistant', content: 'test' }];
        
        const systemTokens = estimateTokensWithRoles(systemMessage);
        const userTokens = estimateTokensWithRoles(userMessage);
        const assistantTokens = estimateTokensWithRoles(assistantMessage);
        
        // All should be greater than base content tokens
        const baseTokens = estimateTokens('test');
        expect(systemTokens).toBeGreaterThan(baseTokens);
        expect(userTokens).toBeGreaterThan(baseTokens);
        expect(assistantTokens).toBeGreaterThan(baseTokens);
    });

    it('should add conversation overhead', () => {
        const singleMessage: Message[] = [{ role: 'user', content: 'test' }];
        const multipleMessages: Message[] = [
            { role: 'user', content: 'test' },
            { role: 'assistant', content: 'test' },
            { role: 'user', content: 'test' }
        ];
        
        const singleTokens = estimateTokensWithRoles(singleMessage);
        const multipleTokens = estimateTokensWithRoles(multipleMessages);
        
        // Multiple messages should have more overhead, but be more realistic about the expectation
        expect(multipleTokens).toBeGreaterThan(singleTokens * 2);
    });
});

describe('createStreamingTransformer', () => {
    it('should create a streaming transformer function', () => {
        const transformer = createStreamingTransformer('gpt-4');
        
        expect(typeof transformer).toBe('function');
    });

    it('should transform streaming chunks correctly', () => {
        const transformer = createStreamingTransformer('gpt-4', 'test-id');
        
        const chunk = transformer('Hello', false);
        
        expect(chunk.id).toBe('test-id');
        expect(chunk.object).toBe('chat.completion.chunk');
        expect(chunk.model).toBe('gpt-4');
        expect(chunk.choices[0].delta.content).toBe('Hello');
        expect(chunk.choices[0].finish_reason).toBeNull();
    });

    it('should handle final chunk correctly', () => {
        const transformer = createStreamingTransformer('gpt-4');
        
        const finalChunk = transformer('', true);
        
        expect(finalChunk.choices[0].delta).toEqual({});
        expect(finalChunk.choices[0].finish_reason).toBe('stop');
    });

    it('should generate unique IDs when not provided', () => {
        const transformer1 = createStreamingTransformer('gpt-4');
        const transformer2 = createStreamingTransformer('gpt-4');
        
        const chunk1 = transformer1('test', false);
        const chunk2 = transformer2('test', false);
        
        expect(chunk1.id).not.toBe(chunk2.id);
    });
});

describe('validateTransformationRequest', () => {
    it('should validate correct requests', () => {
        const validRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Hello' }
            ]
        };
        
        const errors = validateTransformationRequest(validRequest);
        expect(errors).toHaveLength(0);
    });

    it('should catch missing model', () => {
        const invalidRequest = {
            messages: [{ role: 'user', content: 'Hello' }]
        } as ChatCompletionRequest;
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('Model is required and must be a string');
    });

    it('should catch missing messages', () => {
        const invalidRequest = {
            model: 'gpt-4'
        } as ChatCompletionRequest;
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('Messages is required and must be an array');
    });

    it('should catch empty messages array', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: []
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('Messages array cannot be empty');
    });

    it('should validate message roles', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [
                { role: 'invalid' as any, content: 'Hello' }
            ]
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors.some(e => e.includes('role must be'))).toBe(true);
    });

    it('should validate message content', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: '' }
            ]
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors.some(e => e.includes('content is required'))).toBe(true);
    });

    it('should validate temperature range', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 3.0
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('Temperature must be a number between 0 and 2');
    });

    it('should validate max_tokens', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: -1
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('max_tokens must be a positive number');
    });

    it('should validate top_p range', () => {
        const invalidRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            top_p: 1.5
        };
        
        const errors = validateTransformationRequest(invalidRequest);
        expect(errors).toContain('top_p must be a number between 0 and 1');
    });
});

describe('transformError', () => {
    it('should transform basic errors', () => {
        const error = new Error('Something went wrong');
        const result = transformError(error, 'gpt-4', 'openrouter');
        
        expect(result.error.message).toBe('Something went wrong');
        expect(result.error.type).toBe('api_error');
        expect(result.error.code).toBe('provider_error');
        expect(result.error.details?.provider).toBe('openrouter');
        expect(result.error.details?.model).toBe('gpt-4');
        expect(result.error.details?.timestamp).toBeDefined();
    });

    it('should detect authentication errors', () => {
        const error = new Error('Invalid API key provided');
        const result = transformError(error);
        
        expect(result.error.type).toBe('authentication_error');
        expect(result.error.code).toBe('invalid_api_key');
    });

    it('should detect rate limit errors', () => {
        const error = new Error('Rate limit exceeded');
        const result = transformError(error);
        
        expect(result.error.type).toBe('rate_limit_error');
        expect(result.error.code).toBe('rate_limited');
    });

    it('should detect validation errors', () => {
        const error = new Error('Invalid request format');
        const result = transformError(error);
        
        expect(result.error.type).toBe('invalid_request_error');
        expect(result.error.code).toBe('validation_failed');
    });

    it('should detect keys exhausted errors', () => {
        const error = new Error('All API keys failed');
        const result = transformError(error);
        
        expect(result.error.type).toBe('api_error');
        expect(result.error.code).toBe('keys_exhausted');
    });

    it('should handle errors without messages', () => {
        const error = new Error();
        const result = transformError(error);
        
        expect(result.error.message).toBe('An unknown error occurred');
    });
});

describe('Tool usage compatibility', () => {
    it('should handle requests with tool-related parameters', () => {
        const openaiRequest: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'What is the weather like?' }
            ],
            temperature: 0.7,
            max_tokens: 1000
        };

        const mockApiKeys: ApiKeys = { openrouter: 'test-key' };
        const result = transformRequest(openaiRequest, 'openrouter', mockApiKeys);

        // Should preserve all standard parameters that are compatible with tools
        expect(result.temperature).toBe(0.7);
        expect(result.maxTokens).toBe(1000);
        expect(result.provider).toBe('openrouter');
        expect(result.model).toBe('gpt-4');
    });

    it('should handle responses that might contain tool calls', () => {
        const content = 'I need to check the weather. Let me call the weather API for you.';
        const model = 'gpt-4';
        const messages: Message[] = [
            { role: 'user', content: 'What is the weather like?' }
        ];

        const result = transformResponse(content, model, messages);

        expect(result.choices[0].finish_reason).toBe('stop');
        expect(result.choices[0].message.content).toBe(content);
        expect(result.choices[0].message.role).toBe('assistant');
    });

    it('should estimate tokens correctly for tool-related content', () => {
        const toolMessage: Message = {
            role: 'assistant',
            content: 'I will call the get_weather function with parameters: {"location": "New York", "units": "celsius"}'
        };

        const tokens = estimateTokens(toolMessage);
        expect(tokens).toBeGreaterThan(10); // Should account for JSON and function call syntax
    });

    it('should handle complex tool usage scenarios in token estimation', () => {
        const messages: Message[] = [
            { role: 'system', content: 'You have access to weather and calendar tools.' },
            { role: 'user', content: 'What is the weather and my schedule for today?' },
            { role: 'assistant', content: 'I will check both the weather and your calendar.' }
        ];

        const tokens = estimateTokensWithRoles(messages);
        expect(tokens).toBeGreaterThan(20); // Should account for system message and tool context
    });
});