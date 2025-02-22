// API Service Configuration
const API_CONFIG = {
    TODOIST_API_URL: 'https://api.todoist.com/rest/v2',
    OPENAI_API_URL: 'https://api.openai.com/v1',
    GMAIL_API_URL: 'https://gmail.googleapis.com/gmail/v1',
    GCAL_API_URL: 'https://www.googleapis.com/calendar/v3'
};

// Todoist Service
class TodoistService {
    constructor(apiToken) {
        this.apiToken = apiToken;
    }

    async getTasks(filters = {}) {
        const response = await fetch(`${API_CONFIG.TODOIST_API_URL}/tasks`, {
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            }
        });
        return await response.json();
    }

    async getCompletedTasks(filters = {}) {
        const response = await fetch(`${API_CONFIG.TODOIST_API_URL}/completed/tasks`, {
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            }
        });
        return await response.json();
    }

    async createTask(taskData) {
        const response = await fetch(`${API_CONFIG.TODOIST_API_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        return await response.json();
    }
}

// OpenAI Service
class OpenAIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async generatePlan(tasks, preferences) {
        const response = await fetch(`${API_CONFIG.OPENAI_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a productivity assistant helping to organize tasks and create daily plans."
                    },
                    {
                        role: "user",
                        content: `Please create a daily plan based on these tasks: ${JSON.stringify(tasks)}`
                    }
                ]
            })
        });
        return await response.json();
    }

    async generateInsights(completedTasks, metrics) {
        const response = await fetch(`${API_CONFIG.OPENAI_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a productivity analyst helping to generate insights from task completion data."
                    },
                    {
                        role: "user",
                        content: `Please analyze these completed tasks and metrics: ${JSON.stringify({ completedTasks, metrics })}`
                    }
                ]
            })
        });
        return await response.json();
    }
}

// Google Calendar Service
class GoogleCalendarService {
    constructor(apiKey, clientId) {
        this.apiKey = apiKey;
        this.clientId = clientId;
        this.initializeGoogleAPI();
    }

    async initializeGoogleAPI() {
        // Initialize the Google API client
        await gapi.client.init({
            apiKey: this.apiKey,
            clientId: this.clientId,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
            scope: "https://www.googleapis.com/auth/calendar.readonly"
        });
    }

    async getEvents(timeMin, timeMax) {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': timeMin.toISOString(),
            'timeMax': timeMax.toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime'
        });
        return response.result.items;
    }
}

// Email Service
class EmailService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async sendEmail(to, subject, content) {
        // Implementation will depend on your email service provider
        // This is a placeholder for Gmail API implementation
        const email = this.createMimeMessage(to, subject, content);
        const response = await fetch(`${API_CONFIG.GMAIL_API_URL}/users/me/messages/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
            })
        });
        return await response.json();
    }

    createMimeMessage(to, subject, content) {
        const message = [
            'Content-Type: text/html; charset="UTF-8"',
            'MIME-Version: 1.0',
            `To: ${to}`,
            `Subject: ${subject}`,
            '',
            content
        ].join('\n');

        return message;
    }
}

// Analytics Service
class AnalyticsService {
    constructor() {
        this.chartInstances = new Map();
    }

    createTaskCompletionChart(containerId, data) {
        const ctx = document.getElementById(containerId).getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: data.values,
                    borderColor: '#e44332',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        this.chartInstances.set(containerId, chart);
        return chart;
    }

    updateChart(containerId, newData) {
        const chart = this.chartInstances.get(containerId);
        if (chart) {
            chart.data = newData;
            chart.update();
        }
    }

    calculateProductivityScore(tasks) {
        // Implement your productivity score calculation logic here
        // This is a simple example
        const completedTasks = tasks.filter(task => task.completed);
        const overdueTasks = tasks.filter(task => !task.completed && new Date(task.due_date) < new Date());
        
        const completionRate = completedTasks.length / tasks.length;
        const overdueRate = overdueTasks.length / tasks.length;
        
        // Score from 0-10, weighted by completion rate and overdue rate
        return Math.round((completionRate * 10 - overdueRate * 3) * 10) / 10;
    }
}

// Export services
export {
    TodoistService,
    OpenAIService,
    GoogleCalendarService,
    EmailService,
    AnalyticsService
};
