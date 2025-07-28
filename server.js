const express = require('express');
const { LlmManager } = require('./llm_rotation');

const app = express();
const port = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(express.json({ limit: '10mb' }));

// Создаем экземпляр LlmManager
const llmManager = new LlmManager();

// Эндпоинт для совместимости с OpenAI API
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens, top_p, stream } = req.body;

        // Проверяем обязательные поля
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: {
                    message: 'messages field is required and must be an array',
                    type: 'invalid_request_error'
                }
            });
        }

        if (!model) {
            return res.status(400).json({
                error: {
                    message: 'model field is required',
                    type: 'invalid_request_error'
                }
            });
        }

        // Определяем провайдера на основе модели
        const provider = determineProvider(model);
        
        if (!provider) {
            return res.status(400).json({
                error: {
                    message: `Unsupported model: ${model}`,
                    type: 'invalid_request_error'
                }
            });
        }

        // Настройки для LlmManager
        const settings = {
            provider: provider,
            model: model,
            apiKeys: getApiKeysFromEnv(),
            temperature: temperature || 0.7,
            maxTokens: max_tokens || 2048,
            topP: top_p || 0.9,
            siteUrl: req.headers['http-referer'] || 'http://localhost:3000',
            siteName: req.headers['x-title'] || 'LLM Rotation Server'
        };

        // Генерируем ответ
        const response = await llmManager.generateResponse(messages, settings);

        // Возвращаем ответ в формате OpenAI API
        const openaiResponse = {
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

        res.json(openaiResponse);

    } catch (error) {
        console.error('Error processing request:', error);
        
        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'api_error'
            }
        });
    }
});

// Функция для определения провайдера по модели
function determineProvider(model) {
    // Проверяем каждого провайдера из LlmManager.modelConfigurations
    for (const [provider, models] of Object.entries(LlmManager.modelConfigurations)) {
        if (models.some(m => m.id === model)) {
            return provider;
        }
    }
    
    // Дополнительная логика для моделей, которые могут не быть в конфигурации
    if (model.includes('gemini')) return 'gemini';
    if (model.includes('gpt') || model.includes('openai')) return 'openrouter';
    if (model.includes('claude')) return 'openrouter';
    if (model.includes('llama') || model.includes('mistral')) return 'huggingface';
    if (model.includes('deepseek')) return 'chutes';
    
    return null;
}

// Функция для получения API ключей из переменных окружения
function getApiKeysFromEnv() {
    return {
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        huggingface: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN,
        mistral: process.env.MISTRAL_API_KEY,
        cohere: process.env.COHERE_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        chutes: process.env.CHUTES_API_KEY,
        requesty: process.env.REQUESTY_API_KEY
    };
}

// Простая функция для оценки количества токенов (приблизительно)
function estimateTokens(messages) {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4); // Грубая оценка: ~4 символа на токен
}

// Эндпоинт для проверки здоровья сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Эндпоинт для получения списка доступных моделей
app.get('/v1/models', (req, res) => {
    const models = [];
    
    for (const [provider, providerModels] of Object.entries(LlmManager.modelConfigurations)) {
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
    
    res.json({
        object: 'list',
        data: models
    });
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

module.exports = app;