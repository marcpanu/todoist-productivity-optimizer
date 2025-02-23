const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');
const express = require('express');
const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting configuration
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all AI routes
router.use(aiLimiter);

// Error handling middleware
const handleAIError = (error, req, res, next) => {
    console.error('OpenAI API Error:', error);
    
    if (error.response) {
        // OpenAI API error
        const status = error.response.status || 500;
        const message = error.response.data?.error?.message || 'An error occurred with the AI service';
        console.error('OpenAI API Error Details:', {
            status,
            message,
            data: error.response.data
        });
        res.status(status).json({ error: message });
    } else {
        // Other errors
        console.error('Unexpected Error:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
};

// Test endpoint for basic completions
router.post('/test', async (req, res, next) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say 'OpenAI connection test successful!'" }
            ],
            model: "gpt-3.5-turbo",
        });

        res.json({
            success: true,
            message: completion.choices[0].message.content
        });
    } catch (error) {
        next(error);
    }
});

// Generate daily plan based on tasks
router.post('/generate-plan', async (req, res, next) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const { tasks, preferences } = req.body;
        
        if (!tasks || !Array.isArray(tasks)) {
            return res.status(400).json({ error: 'Tasks array is required' });
        }

        const tasksList = tasks.map(task => 
            `- ${task.content} (Due: ${task.due?.date || 'No due date'}, Priority: ${task.priority})`
        ).join('\n');

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a productivity assistant helping to organize and prioritize tasks. Create an optimized daily plan that considers task priorities, due dates, and estimated effort."
                },
                {
                    role: "user",
                    content: `Please create a daily plan for these tasks:\n${tasksList}\n\nConsider task priorities and due dates. Format the response as a clear, actionable plan.`
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        });

        res.json({
            plan: completion.choices[0].message.content,
            usage: completion.usage
        });
    } catch (error) {
        console.error('Generate plan endpoint error:', error);
        next(error);
    }
});

// Apply error handling middleware
router.use(handleAIError);

module.exports = router;
