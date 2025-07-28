# Design Document

## Overview

Данный дизайн описывает создание TypeScript Node.js HTTP сервера-обертки над существующим модулем `llm_rotation.ts`. Сервер предоставляет REST API, совместимый с OpenAI API, который автоматически маршрутизирует запросы к соответствующим LLM провайдерам, сохраняя при этом все преимущества умной системы ротации API ключей.

**Преимущества TypeScript подхода:**
- Полная типизация всех API контрактов
- Интеграция с существующими типами из llm_rotation.ts
- Compile-time проверка совместимости
- Лучшая поддержка IDE и рефакторинга

Ключевая особенность дизайна - полное сохранение и использование существующего механизма ротации ключей из `LlmManager`, который обеспечивает:
- Автоматическое переключение между ключами
- Отслеживание статуса каждого ключа
- Умную обработку rate-limiting
- Автоматический fallback при сбоях

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   HTTP Client   │───▶│  Express Server  │───▶│   LlmManager        │
│                 │    │                  │    │   (llm_rotation.ts) │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │                          │
                                ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────────┐
                       │  Request/Response│    │  Provider APIs      │
                       │  Transformation  │    │  (Gemini, OpenRouter,│
                       │                  │    │   HuggingFace, etc.)│
                       └──────────────────┘    └─────────────────────┘
```

### Component Interaction Flow

```
1. HTTP Request (OpenAI format) → Express Server
2. Request Validation & Parsing → Server Logic
3. Model → Provider Mapping → Provider Detection
4. Settings Configuration → LlmManager Setup
5. LlmManager.generateResponse() → Provider API Call
6. Key Rotation & Status Tracking → LlmManager Internal
7. Response Transformation → OpenAI Format
8. HTTP Response → Client
```

## Components and Interfaces

### 1. Express Server (`server.ts`)

**Responsibilities:**
- HTTP request handling with full TypeScript type safety
- Request/response format transformation
- Error handling and logging
- Environment configuration management

**TypeScript Benefits:**
- Compile-time type checking for API contracts
- Better IDE support and autocompletion
- Safer refactoring and maintenance
- Integration with existing llm_rotation.ts types

**Key Endpoints:**
- `POST /v1/chat/completions` - Main chat endpoint
- `GET /v1/models` - Model listing endpoint  
- `GET /health` - Health check endpoint
- `GET /v1/keys/status` - API key status endpoint (new)

**TypeScript Interfaces:**
```typescript
interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}

interface ServerResponse<T> {
    success: boolean;
    data?: T;
    error?: ErrorDetails;
}
```

### 2. Provider Detection Module

**Responsibilities:**
- Automatic provider detection based on model name
- Model validation against supported configurations
- Fallback logic for unknown models

**TypeScript Implementation:**
```typescript
import { LlmManager, Provider } from './llm_rotation';

function determineProvider(model: string): Provider | null {
    // 1. Check LlmManager.modelConfigurations for exact match
    for (const [provider, models] of Object.entries(LlmManager.modelConfigurations)) {
        if (models.some(m => m.id === model)) {
            return provider as Provider;
        }
    }
    
    // 2. Pattern-based fallback detection
    if (model.includes('gemini')) return 'gemini';
    if (model.includes('gpt') || model.includes('claude')) return 'openrouter';
    // ... other patterns
    
    return null; // Unsupported model
}
```

### 3. Configuration Manager

**Responsibilities:**
- Environment variable parsing with type safety
- API key array support
- Default value management

**TypeScript Implementation:**
```typescript
import { ApiKeys } from './llm_rotation';

interface ServerConfig {
    port: number;
    apiKeys: ApiKeys;
    defaultSettings: {
        temperature: number;
        maxTokens: number;
        topP: number;
    };
}

function loadConfiguration(): ServerConfig {
    return {
        port: parseInt(process.env.PORT || '3000'),
        apiKeys: parseApiKeys(),
        defaultSettings: {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 0.9
        }
    };
}

function parseApiKeys(): ApiKeys {
    const keys: ApiKeys = {};
    
    // Support for comma-separated keys: OPENROUTER_API_KEY=key1,key2,key3
    const providers = ['gemini', 'openrouter', 'huggingface', 'mistral', 'cohere', 'nvidia', 'chutes', 'requesty'];
    
    providers.forEach(provider => {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const envValue = process.env[envKey];
        if (envValue) {
            keys[provider] = envValue.includes(',') ? envValue.split(',').map(k => k.trim()) : envValue;
        }
    });
    
    return keys;
}
```

**Key Features:**
- Type-safe environment variable parsing
- Support for multiple keys per provider: `OPENROUTER_API_KEY=key1,key2,key3`
- Backward compatibility with single keys
- Secure key handling with TypeScript validation

### 4. Request/Response Transformers

**TypeScript Input Transformer (OpenAI → LlmManager):**
```typescript
import { Message, LlmSettings } from './llm_rotation';

function transformRequest(
    openaiRequest: ChatCompletionRequest, 
    provider: Provider, 
    apiKeys: ApiKeys
): LlmSettings {
    return {
        provider,
        model: openaiRequest.model,
        apiKeys,
        temperature: openaiRequest.temperature ?? 0.7,
        maxTokens: openaiRequest.max_tokens ?? 2048,
        topP: openaiRequest.top_p ?? 0.9,
        siteUrl: 'http://localhost:3000',
        siteName: 'LLM Rotation Server'
    };
}
```

**TypeScript Output Transformer (LlmManager → OpenAI):**
```typescript
function transformResponse(
    content: string, 
    model: string, 
    messages: Message[]
): ChatCompletionResponse {
    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop'
        }],
        usage: {
            prompt_tokens: estimateTokens(messages),
            completion_tokens: estimateTokens([{ role: 'assistant', content }]),
            total_tokens: estimateTokens(messages) + estimateTokens([{ role: 'assistant', content }])
        }
    };
}
```

## Data Models

### Request Models

```typescript
interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
    // Additional OpenAI parameters
}

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
```

### Response Models

```typescript
interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Choice[];
    usage: Usage;
}

interface Choice {
    index: number;
    message: Message;
    finish_reason: 'stop' | 'length' | 'content_filter';
}

interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
```

### Internal Models

```typescript
interface ServerConfig {
    port: number;
    apiKeys: Record<string, string[]>;
    defaultSettings: {
        temperature: number;
        maxTokens: number;
        topP: number;
    };
}

interface KeyStatusResponse {
    provider: string;
    keys: Array<{
        index: number;
        status: 'untested' | 'working' | 'failed' | 'rate-limited';
        lastUsed?: Date;
    }>;
}
```

## Error Handling

### Error Categories

1. **Validation Errors (400)**
   - Missing required fields
   - Invalid model names
   - Malformed requests

2. **Authentication Errors (401)**
   - Missing API keys
   - Invalid API keys

3. **Provider Errors (502)**
   - All API keys exhausted
   - Provider-specific errors

4. **Server Errors (500)**
   - Internal processing errors
   - Unexpected exceptions

### TypeScript Error Response Format

```typescript
interface ErrorResponse {
    error: {
        message: string;
        type: 'invalid_request_error' | 'api_error' | 'authentication_error';
        code: 'model_not_found' | 'keys_exhausted' | 'validation_failed';
        details?: {
            provider?: string;
            keyStatuses?: string[];
            lastError?: string;
        };
    };
}

class ApiError extends Error {
    constructor(
        message: string,
        public type: ErrorResponse['error']['type'],
        public code: ErrorResponse['error']['code'],
        public details?: ErrorResponse['error']['details']
    ) {
        super(message);
        this.name = 'ApiError';
    }
    
    toResponse(): ErrorResponse {
        return {
            error: {
                message: this.message,
                type: this.type,
                code: this.code,
                details: this.details
            }
        };
    }
}
```

### Key Rotation Error Handling

Сервер должен предоставлять детальную информацию о состоянии ключей при ошибках:

```typescript
// При исчерпании всех ключей
function handleKeyExhaustion(provider: Provider, error: Error, llmManager: LlmManager): ApiError {
    return new ApiError(
        `All ${provider} API keys failed. Last error: ${error.message}`,
        'api_error',
        'keys_exhausted',
        {
            provider,
            keyStatuses: llmManager.apiKeyStatus[provider]?.map(status => status) || [],
            lastError: error.message
        }
    );
}
```

## Testing Strategy

### Unit Tests

1. **Provider Detection Tests**
   - Test model → provider mapping
   - Test fallback logic
   - Test unknown model handling

2. **Request Transformation Tests**
   - OpenAI → LlmManager format conversion
   - Parameter mapping validation
   - Default value application

3. **Response Transformation Tests**
   - LlmManager → OpenAI format conversion
   - Token estimation accuracy
   - Error response formatting

4. **Configuration Tests**
   - Environment variable parsing
   - API key array handling
   - Default configuration loading

### Integration Tests

1. **End-to-End API Tests**
   - Full request/response cycle
   - Multiple provider testing
   - Error scenario testing

2. **Key Rotation Tests**
   - Multiple key cycling
   - Failure handling
   - Status tracking accuracy

3. **LlmManager Integration Tests**
   - Verify preservation of rotation logic
   - Status monitoring functionality
   - Provider-specific features

### Load Tests

1. **Concurrent Request Handling**
   - Multiple simultaneous requests
   - Key rotation under load
   - Memory usage monitoring

2. **Key Exhaustion Scenarios**
   - Behavior when all keys fail
   - Recovery after key restoration
   - Rate limit handling

## Performance Considerations

### Key Rotation Optimization

- Preserve LlmManager's built-in rotation logic
- Avoid unnecessary key status checks
- Cache provider detection results

### Memory Management

- Reuse single LlmManager instance
- Avoid storing large response objects
- Implement request timeout handling

### Monitoring and Logging

- Log key rotation events
- Track provider usage statistics
- Monitor response times per provider

## Security Considerations

### API Key Management

- Store keys only in environment variables
- Never log API keys
- Support key rotation without restart

### Request Validation

- Validate all input parameters
- Sanitize user content
- Implement rate limiting per client

### Error Information Disclosure

- Avoid exposing internal errors to clients
- Log detailed errors server-side only
- Provide generic error messages for security