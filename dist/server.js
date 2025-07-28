"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const llm_rotation_1 = require("./llm_rotation");
const provider_detection_1 = require("./provider-detection");
const config_1 = require("./config");
const errors_1 = require("./errors");
const transformations_1 = require("./transformations");
const types_1 = require("./types");
// Create Express app
const app = (0, express_1.default)();
// Load and validate configuration (only if not in test environment)
let config;
if (process.env.NODE_ENV !== 'test') {
    config = (0, config_1.loadConfiguration)();
    (0, config_1.validateConfiguration)(config);
}
else {
    // Use test configuration
    config = {
        port: 3000,
        apiKeys: {
            gemini: 'test-gemini-key',
            openrouter: 'test-openrouter-key'
        },
        defaultSettings: {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 0.9,
            siteUrl: 'http://localhost:3000',
            siteName: 'LLM Rotation Server'
        },
        enableLogging: false,
        environment: 'test',
        requestTimeout: 30000
    };
}
// ===== MIDDLEWARE SETUP =====
// Request parsing middleware
app.use(express_1.default.json({
    limit: '10mb',
    type: 'application/json'
}));
// Request context middleware (always set requestId)
app.use((req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    // Add request context to request object
    req.context = {
        requestId,
        startTime,
        clientIp: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    };
    // Only log if logging is enabled
    if (config.enableLogging) {
        console.log(`[${requestId}] ${req.method} ${req.path} - ${req.ip || 'unknown'}`);
        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            console.log(`[${requestId}] ${res.statusCode} - ${duration}ms`);
        });
    }
    next();
});
// Request timeout middleware
app.use((req, res, next) => {
    const timeout = config.requestTimeout || 30000;
    const timer = setTimeout(() => {
        if (!res.headersSent) {
            const error = types_1.ApiError.timeout('server', timeout);
            res.status(error.statusCode).json(error.toResponse());
        }
    }, timeout);
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
});
// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
// Error handling middleware (must be last)
app.use((error, req, res, next) => {
    const requestId = req.context?.requestId || 'unknown';
    if (error instanceof types_1.ApiError) {
        const response = errors_1.ErrorResponseFormatter.logAndFormatError(error, requestId, config.environment === 'development');
        res.status(error.statusCode).json(response);
        return;
    }
    // Handle JSON parsing errors
    if (error instanceof SyntaxError && 'body' in error) {
        const apiError = types_1.ApiError.validation('Invalid JSON in request body');
        const response = errors_1.ErrorResponseFormatter.logAndFormatError(apiError, requestId, config.environment === 'development');
        res.status(apiError.statusCode).json(response);
        return;
    }
    // Handle generic errors
    const apiError = errors_1.ErrorTransformer.fromGenericError(error);
    const response = errors_1.ErrorResponseFormatter.logAndFormatError(apiError, requestId, config.environment === 'development');
    res.status(apiError.statusCode).json(response);
});
// ===== LLM MANAGER SETUP =====
// Create LlmManager instance with configuration
const llmManager = new llm_rotation_1.LlmManager();
// Log configuration summary on startup
if (config.enableLogging) {
    console.log('🔧 Server Configuration:', (0, config_1.getConfigSummary)(config));
}
// ===== API ENDPOINTS =====
// Main chat completions endpoint
app.post('/v1/chat/completions', async (req, res, next) => {
    try {
        const requestBody = req.body;
        const { messages, model, temperature, max_tokens, top_p } = requestBody;
        const requestId = req.context?.requestId || 'unknown';
        // Comprehensive request validation
        const validationErrors = [];
        // Validate required fields
        const requiredFieldError = errors_1.ValidationErrorHandler.validateRequiredFields(requestBody, ['messages', 'model']);
        if (requiredFieldError)
            validationErrors.push(requiredFieldError);
        // Validate messages format
        if (messages) {
            const messagesError = errors_1.ValidationErrorHandler.validateMessages(messages);
            if (messagesError)
                validationErrors.push(messagesError);
        }
        // Validate model
        if (model) {
            const modelError = errors_1.ValidationErrorHandler.validateModel(model);
            if (modelError)
                validationErrors.push(modelError);
        }
        // Validate optional parameters
        const tempError = errors_1.ValidationErrorHandler.validateTemperature(temperature);
        if (tempError)
            validationErrors.push(tempError);
        const maxTokensError = errors_1.ValidationErrorHandler.validateMaxTokens(max_tokens);
        if (maxTokensError)
            validationErrors.push(maxTokensError);
        const topPError = errors_1.ValidationErrorHandler.validateTopP(top_p);
        if (topPError)
            validationErrors.push(topPError);
        // Return validation errors if any
        if (validationErrors.length > 0) {
            const { statusCode, body } = errors_1.ErrorResponseFormatter.formatMultipleErrors(validationErrors);
            res.status(statusCode).json(body);
            return;
        }
        // Determine provider
        const provider = (0, provider_detection_1.determineProvider)(model);
        if (!provider) {
            const error = types_1.ApiError.modelNotFound(model);
            res.status(error.statusCode).json(error.toResponse());
            return;
        }
        // Transform request using transformations module
        const settings = (0, transformations_1.transformRequest)(requestBody, provider, config.apiKeys, {
            temperature: config.defaultSettings.temperature,
            maxTokens: config.defaultSettings.maxTokens,
            topP: config.defaultSettings.topP,
            siteUrl: req.headers['http-referer'] || config.defaultSettings.siteUrl || 'http://localhost:3000',
            siteName: req.headers['x-title'] || config.defaultSettings.siteName || 'LLM Rotation Server'
        });
        if (config.enableLogging) {
            console.log(`[${requestId}] Using provider: ${provider}, model: ${model}`);
        }
        // Generate response using LlmManager
        const response = await llmManager.generateResponse(messages, settings);
        // Transform response using transformations module
        const openaiResponse = (0, transformations_1.transformResponse)(response, model, messages, requestId);
        res.json(openaiResponse);
    }
    catch (error) {
        // Transform and pass to error handling middleware
        const detectedProvider = req.body?.model ? (0, provider_detection_1.determineProvider)(req.body.model) : null;
        const apiError = error instanceof types_1.ApiError
            ? error
            : errors_1.ErrorTransformer.fromGenericError(error, {
                provider: detectedProvider || undefined,
                model: req.body?.model
            });
        next(apiError);
    }
});
// Health check endpoint
app.get('/health', (_req, res) => {
    const healthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime() * 1000, // Convert to milliseconds
        memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        }
    };
    res.json(healthResponse);
});
// Models listing endpoint
app.get('/v1/models', (_req, res) => {
    const models = [];
    for (const [provider, providerModels] of Object.entries(llm_rotation_1.LlmManager.modelConfigurations)) {
        for (const model of providerModels) {
            models.push({
                id: model.id,
                object: 'model',
                created: Math.floor(Date.now() / 1000),
                owned_by: provider,
                permission: [],
                root: model.id,
                parent: null
            });
        }
    }
    const response = {
        object: 'list',
        data: models
    };
    res.json(response);
});
// API key status monitoring endpoint
app.get('/v1/keys/status', (_req, res) => {
    try {
        const providers = {};
        let overallHealthy = 0;
        let overallTotal = 0;
        // Iterate through all configured providers
        for (const [providerName, keyStatuses] of Object.entries(llmManager.apiKeyStatus)) {
            const provider = providerName;
            const configuredKeys = config.apiKeys[provider];
            // Skip providers that don't have keys configured
            if (!configuredKeys) {
                continue;
            }
            // Normalize keys to array format
            const keysArray = Array.isArray(configuredKeys) ? configuredKeys : [configuredKeys];
            const totalKeys = keysArray.length;
            // Get current key index (private property, so we'll track it differently)
            const currentKeyIndex = llmManager._apiKeyIndices?.[provider] || 0;
            // Build key status information
            const keys = keyStatuses.map((status, index) => ({
                index,
                status,
                // Don't expose actual key values for security
                lastUsed: undefined, // LlmManager doesn't track this currently
                lastError: undefined, // LlmManager doesn't track this currently
                successCount: undefined, // LlmManager doesn't track this currently
                failureCount: undefined // LlmManager doesn't track this currently
            }));
            // Count healthy keys
            const healthyKeys = keyStatuses.filter(status => status === 'working' || status === 'untested').length;
            overallHealthy += healthyKeys;
            overallTotal += totalKeys;
            providers[provider] = {
                provider,
                totalKeys,
                currentKeyIndex,
                keys,
                lastRotation: undefined // LlmManager doesn't track this currently
            };
        }
        // Determine overall system status
        let systemStatus;
        if (overallTotal === 0) {
            systemStatus = 'critical'; // No keys configured
        }
        else if (overallHealthy === 0) {
            systemStatus = 'critical'; // All keys failed
        }
        else if (overallHealthy < overallTotal * 0.5) {
            systemStatus = 'degraded'; // Less than 50% keys working
        }
        else {
            systemStatus = 'healthy';
        }
        const response = {
            providers,
            systemStatus,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        const apiError = error instanceof types_1.ApiError
            ? error
            : errors_1.ErrorTransformer.fromGenericError(error);
        res.status(apiError.statusCode).json(apiError.toResponse());
    }
});
// ===== SERVER STARTUP =====
// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(config.port, () => {
        console.log(`🚀 LLM Rotation Server запущен на порту ${config.port}`);
        console.log(`📋 Доступные эндпоинты:`);
        console.log(`   POST /v1/chat/completions - Основной эндпоинт для чата`);
        console.log(`   GET  /v1/models - Список доступных моделей`);
        console.log(`   GET  /health - Проверка состояния сервера`);
        if (config.enableLogging) {
            console.log(`\n🔧 Конфигурация:`);
            console.log(`   Environment: ${config.environment}`);
            console.log(`   Logging: ${config.enableLogging ? 'enabled' : 'disabled'}`);
            console.log(`   Request timeout: ${config.requestTimeout}ms`);
            console.log(`   Providers configured: ${Object.keys(config.apiKeys).join(', ')}`);
        }
        console.log(`\n🔑 Убедитесь, что установлены переменные окружения для API ключей:`);
        console.log(`   GEMINI_API_KEY, OPENROUTER_API_KEY, HUGGINGFACE_API_KEY, и т.д.`);
    });
    // Graceful shutdown handling
    process.on('SIGTERM', () => {
        console.log('🛑 Получен сигнал SIGTERM, завершаем сервер...');
        server.close(() => {
            console.log('✅ Сервер успешно завершен');
            process.exit(0);
        });
    });
    process.on('SIGINT', () => {
        console.log('🛑 Получен сигнал SIGINT, завершаем сервер...');
        server.close(() => {
            console.log('✅ Сервер успешно завершен');
            process.exit(0);
        });
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map