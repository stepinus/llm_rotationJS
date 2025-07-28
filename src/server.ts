import express from 'express';
import { LlmManager } from './llm_rotation';
import { determineProvider } from './provider-detection';
import type {
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelsListResponse,
    HealthCheckResponse,
    ServerConfig,
    ApiKeys,
    Provider,
    Message
} from './types';
import { ApiError } from './types';

const app = express();
const port = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(express.json({ limit: '10mb' }));

// Создаем экземпляр LlmManager
const llmManager = new LlmManager();

// Эндпоинт для совместимости с OpenAI API
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const requestBody: ChatCompletionRequest = req.body;
        const { messages, model, temperature, max_tokens, top_p } = requestBody;

        // Проверяем обязательные поля
        if (!messages || !Array.isArray(messages)) {
            const error = ApiError.validation('messages field is required and must be an array', {
                messages: 'Field is required and must be an array'
            });
            return res.status(error.statusCode).json(error.toResponse());
        }

        if (!model) {
            const error = ApiError.validation('model field is required', {
                model: 'Field is required'
            });
            return res.status(error.statusCode).json(error.toResponse());
        }

        // Определяем провайдера на основе модели
        const provider = determineProvider(model);

        if (!provider) {
            const error = ApiError.modelNotFound(model);
            return res.status(error.statusCode).json(error.toResponse());
        }

        // Настройки для LlmManager
        const settings = {
            provider: provider,
            model: model,
            apiKeys: getApiKeysFromEnv(),
            temperature: temperature || 0.7,
            maxTokens: max_tokens || 2048,
            topP: top_p || 0.9,
            siteUrl: req.headers['http-referer'] as string || 'http://localhost:3000',
            siteName: req.headers['x-title'] as string || 'LLM Rotation Server'
        };

        // Генерируем ответ
        const response = await llmManager.generateResponse(messages, settings);

        // Возвращаем ответ в формате OpenAI API
        const openaiResponse: ChatCompletionResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: response
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: estimateTokens(messages),
                completion_tokens: estimateTokens([{ role: 'assistant', content: response }]),
                total_tokens: estimateTokens(messages) + estimateTokens([{ role: 'assistant', content: response }])
            }
        };

        return res.json(openaiResponse);

    } catch (error) {
        console.error('Error processing request:', error);

        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(error.toResponse());
        }

        // Handle generic errors
        const apiError = new ApiError(
            (error as Error).message || 'Internal server error',
            'server_error',
            'internal_error',
            500
        );
        return res.status(apiError.statusCode).json(apiError.toResponse());
    }
});



// Функция для получения API ключей из переменных окружения
function getApiKeysFromEnv(): ApiKeys {
    return {
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
        openrouter: process.env.OPENROUTER_API_KEY || '',
        huggingface: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || '',
        mistral: process.env.MISTRAL_API_KEY || '',
        cohere: process.env.COHERE_API_KEY || '',
        nvidia: process.env.NVIDIA_API_KEY || '',
        chutes: process.env.CHUTES_API_KEY || '',
        requesty: process.env.REQUESTY_API_KEY || ''
    };
}

// Простая функция для оценки количества токенов (приблизительно)
function estimateTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4); // Грубая оценка: ~4 символа на токен
}

// Эндпоинт для проверки здоровья сервера
app.get('/health', (_req, res) => {
    const healthResponse: HealthCheckResponse = {
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

// Эндпоинт для получения списка доступных моделей
app.get('/v1/models', (_req, res) => {
    const models = [];

    for (const [provider, providerModels] of Object.entries(LlmManager.modelConfigurations)) {
        for (const model of providerModels) {
            models.push({
                id: model.id,
                object: 'model' as const,
                created: Math.floor(Date.now() / 1000),
                owned_by: provider,
                permission: [],
                root: model.id,
                parent: null
            });
        }
    }

    const response: ModelsListResponse = {
        object: 'list',
        data: models
    };

    res.json(response);
});

// Запуск сервера
app.listen(port, () => {
    console.log(`🚀 LLM Rotation Server запущен на порту ${port}`);
    console.log(`📋 Доступные эндпоинты:`);
    console.log(`   POST /v1/chat/completions - Основной эндпоинт для чата`);
    console.log(`   GET  /v1/models - Список доступных моделей`);
    console.log(`   GET  /health - Проверка состояния сервера`);
    console.log(`\n🔑 Убедитесь, что установлены переменные окружения для API ключей:`);
    console.log(`   GEMINI_API_KEY, OPENROUTER_API_KEY, HUGGINGFACE_API_KEY, и т.д.`);
});

export default app;