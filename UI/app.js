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
        const response = await fetch('/api/todoist/user', {
            credentials: 'include'
        });
        const data = await response.json();
        
        const status = document.getElementById('todoist-status');
        const connectBtn = document.getElementById('todoist-connect');
        const disconnectBtn = document.getElementById('todoist-disconnect');
        
        if (response.ok) {
            status.textContent = 'Connected';
            status.classList.add('connected');
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
        } else {
            status.textContent = 'Not Connected';
            status.classList.remove('connected');
            connectBtn.style.display = 'block';
            disconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Todoist connection:', error);
    }
}

// Function to check Google connection status
async function checkGoogleConnection() {
    try {
        const response = await fetch('/api/google/status', {
            credentials: 'include'
        });
        const data = await response.json();
        
        const calendarStatus = document.getElementById('google-status');
        const calendarConnectBtn = document.getElementById('google-connect');
        const calendarDisconnectBtn = document.getElementById('google-disconnect');
        
        const gmailStatus = document.getElementById('gmail-status');
        const gmailConnectBtn = document.getElementById('gmail-connect');
        const gmailDisconnectBtn = document.getElementById('gmail-disconnect');
        
        if (data.connected) {
            // Update Calendar status
            calendarStatus.textContent = 'Connected';
            calendarStatus.classList.add('connected');
            calendarConnectBtn.style.display = 'none';
            calendarDisconnectBtn.style.display = 'block';
            
            // Update Gmail status
            gmailStatus.textContent = 'Connected';
            gmailStatus.classList.add('connected');
            gmailConnectBtn.style.display = 'none';
            gmailDisconnectBtn.style.display = 'block';
        } else {
            // Update Calendar status
            calendarStatus.textContent = 'Not Connected';
            calendarStatus.classList.remove('connected');
            calendarConnectBtn.style.display = 'block';
            calendarDisconnectBtn.style.display = 'none';
            
            // Update Gmail status
            gmailStatus.textContent = 'Not Connected';
            gmailStatus.classList.remove('connected');
            gmailConnectBtn.style.display = 'block';
            gmailDisconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Google connection:', error);
    }
}

// Function to handle Todoist connection
function connectTodoist() {
    window.location.href = '/api/auth/todoist';
}

// Function to handle Google connection
function connectGoogle() {
    window.location.href = '/api/google/auth';
}

// Function to handle Todoist disconnection
async function disconnectTodoist() {
    try {
        const response = await fetch('/api/todoist/disconnect', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            checkTodoistConnection();
        }
    } catch (error) {
        console.error('Error disconnecting Todoist:', error);
    }
}

// Function to handle Google disconnection
async function disconnectGoogle() {
    try {
        const response = await fetch('/api/google/disconnect', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            checkGoogleConnection();
        }
    } catch (error) {
        console.error('Error disconnecting Google:', error);
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

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check connection status when the profile tab is shown
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'profile-tab' && mutation.target.classList.contains('active')) {
                checkTodoistConnection();
                checkGoogleConnection();
            }
        });
    });

    const profileTab = document.getElementById('profile-tab');
    observer.observe(profileTab, { attributes: true, attributeFilter: ['class'] });

    // Add click handlers for connection buttons
    document.getElementById('todoist-connect').addEventListener('click', connectTodoist);
    document.getElementById('todoist-disconnect').addEventListener('click', disconnectTodoist);
    document.getElementById('google-connect').addEventListener('click', connectGoogle);
    document.getElementById('google-disconnect').addEventListener('click', disconnectGoogle);
    document.getElementById('gmail-connect').addEventListener('click', connectGoogle);
    document.getElementById('gmail-disconnect').addEventListener('click', disconnectGoogle);

    // Tab switching logic
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const contentId = tab.dataset.tab;
            document.getElementById(contentId).classList.add('active');
        });
    });

    // Initial check if we're on the profile tab
    const currentTab = document.querySelector('.nav-item.active');
    if (currentTab && currentTab.dataset.tab === 'profile-tab') {
        checkTodoistConnection();
        checkGoogleConnection();
    }

    // Add event listeners to navigation items
    navItems.forEach(item => {
        item.addEventListener('click', window.handleNavigation);
    });

    // Initialize first tab
    initializePlanTab();
});
