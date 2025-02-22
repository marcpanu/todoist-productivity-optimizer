// API Service Configuration
const API_CONFIG = {
    TODOIST_API_URL: 'https://api.todoist.com/rest/v2',
    OPENAI_API_URL: 'https://api.openai.com/v1',
    GMAIL_API_URL: 'https://gmail.googleapis.com/gmail/v1',
    GCAL_API_URL: 'https://www.googleapis.com/calendar/v3'
};

// Services
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
}

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
}

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
}

// Function to check Todoist connection status
async function checkTodoistConnection() {
    try {
        const response = await fetch('/api/debug/session');
        const data = await response.json();
        
        const todoistStatus = document.getElementById('todoist-status');
        const connectButton = document.getElementById('todoist-connect');
        const disconnectButton = document.getElementById('todoist-disconnect');
        
        if (data.isAuthenticated && data.user) {
            todoistStatus.textContent = 'Connected';
            todoistStatus.className = 'connected';
            connectButton.style.display = 'none';
            disconnectButton.style.display = 'flex';
        } else {
            todoistStatus.textContent = 'Not Connected';
            todoistStatus.className = 'disconnected';
            connectButton.style.display = 'flex';
            disconnectButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Todoist connection:', error);
    }
}

// Function to handle Todoist disconnect
async function handleTodoistDisconnect() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            console.error('Failed to disconnect from Todoist');
        }
    } catch (error) {
        console.error('Error disconnecting from Todoist:', error);
    }
}

// Initialize Services
const todoistService = new TodoistService(localStorage.getItem('todoist_token'));
const openaiService = new OpenAIService(localStorage.getItem('openai_token'));
const analyticsService = new AnalyticsService();

// DOM Elements
const mainContent = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');
const tasksChart = document.getElementById('tasksChart');

// State Management
let currentTab = 'plan-tab';
let tasks = [];
let completedTasks = [];

// Navigation Handler
window.handleNavigation = function(event) {
    const targetTab = event.currentTarget.dataset.tab;
    if (targetTab === currentTab) return;

    // Update active states
    document.querySelector(`.nav-item[data-tab="${currentTab}"]`).classList.remove('active');
    document.getElementById(currentTab).classList.remove('active');
    
    event.currentTarget.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
    
    currentTab = targetTab;

    // Initialize tab-specific content
    if (targetTab === 'trends-tab') {
        initializeTrendsTab();
    } else if (targetTab === 'plan-tab') {
        initializePlanTab();
    } else if (targetTab === 'review-tab') {
        initializeReviewTab();
    } else if (targetTab === 'email-tab') {
        initializeEmailTab();
    }
}

// Tab Initialization Functions
async function initializePlanTab() {
    try {
        tasks = await todoistService.getTasks();
        const tasksList = document.getElementById('tasks-list');
        tasksList.innerHTML = tasks.map(task => `
            <div class="task-item" data-id="${task.id}">
                <div class="task-content">
                    <span class="task-title">${task.content}</span>
                    <span class="task-due">${task.due ? new Date(task.due.date).toLocaleDateString() : 'No due date'}</span>
                </div>
                <div class="task-priority">P${task.priority}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksList.innerHTML = '<div class="error">Error loading tasks. Please check your Todoist API token.</div>';
    }
}

async function initializeReviewTab() {
    try {
        completedTasks = await todoistService.getCompletedTasks();
        const insights = await openaiService.generatePlan(completedTasks, {
            totalTasks: tasks.length,
            completedTasks: completedTasks.length
        });
        
        const reportContent = document.getElementById('report-content');
        reportContent.innerHTML = `
            <div class="report">
                <h2>Productivity Insights</h2>
                <div class="insights-content">${insights.choices[0].message.content}</div>
                <div class="metrics">
                    <div class="metric">
                        <h3>Tasks Completed</h3>
                        <p>${completedTasks.length}</p>
                    </div>
                    <div class="metric">
                        <h3>Completion Rate</h3>
                        <p>${Math.round(completedTasks.length / tasks.length * 100)}%</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating review:', error);
        reportContent.innerHTML = '<div class="error">Error generating review. Please check your OpenAI API key.</div>';
    }
}

async function initializeEmailTab() {
    const templateList = document.querySelector('.template-list');
    const templates = [
        { id: 1, name: 'Daily Summary', schedule: 'daily' },
        { id: 2, name: 'Weekly Report', schedule: 'weekly' },
        { id: 3, name: 'Monthly Review', schedule: 'monthly' }
    ];
    
    templateList.innerHTML = templates.map(template => `
        <div class="template-item">
            <div class="template-info">
                <span class="template-name">${template.name}</span>
                <span class="template-schedule">${template.schedule}</span>
            </div>
            <button onclick="handleSendEmail(${template.id})" class="send-button">
                Send Now
            </button>
        </div>
    `).join('');
}

async function initializeTrendsTab() {
    try {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const weeklyTasks = await todoistService.getCompletedTasks({
            since: lastWeek.toISOString()
        });
        
        const tasksByDay = weeklyTasks.reduce((acc, task) => {
            const date = new Date(task.completed_date).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        
        if (!tasksChart) return;
        
        analyticsService.createTaskCompletionChart('tasksChart', {
            labels: Object.keys(tasksByDay),
            values: Object.values(tasksByDay)
        });
        
    } catch (error) {
        console.error('Error initializing trends:', error);
        document.querySelector('.chart-container').innerHTML = '<div class="error">Error loading trends. Please check your API token.</div>';
    }
}

// Event Handlers
window.handleGeneratePlan = async function() {
    try {
        const plan = await openaiService.generatePlan(tasks, {
            preferredWorkingHours: '9:00-17:00',
            breakDuration: 30
        });
        
        const tasksList = document.getElementById('tasks-list');
        tasksList.innerHTML = `
            <div class="plan-summary">
                <p>${plan.choices[0].message.content}</p>
            </div>
        `;
    } catch (error) {
        console.error('Error generating plan:', error);
        tasksList.innerHTML = '<div class="error">Error generating plan. Please check your OpenAI API key.</div>';
    }
}

window.handleSendEmail = async function(templateId) {
    alert('Email feature coming soon!');
}

// Check Todoist connection status when the profile tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.tab === 'profile-tab') {
                checkTodoistConnection();
            }
        });
    });
    
    // Initial check if we're on the profile tab
    const currentTab = document.querySelector('.nav-item.active');
    if (currentTab && currentTab.dataset.tab === 'profile-tab') {
        checkTodoistConnection();
    }

    // Add event listeners to navigation items
    navItems.forEach(item => {
        item.addEventListener('click', window.handleNavigation);
    });

    // Initialize first tab
    initializePlanTab();
});
