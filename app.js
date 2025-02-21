import {
    TodoistService,
    OpenAIService,
    GoogleCalendarService,
    EmailService,
    AnalyticsService
} from './services.js';

// Initialize Services
const todoistService = new TodoistService(localStorage.getItem('todoist_token'));
const openaiService = new OpenAIService(localStorage.getItem('openai_token'));
const calendarService = new GoogleCalendarService(
    localStorage.getItem('google_api_key'),
    localStorage.getItem('google_client_id')
);
const emailService = new EmailService(localStorage.getItem('gmail_token'));
const analyticsService = new AnalyticsService();

// DOM Elements
const mainContent = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');
const tasksChart = document.getElementById('tasksChart');

// State Management
let currentTab = 'plan-tab';
let tasks = [];
let completedTasks = [];
let events = [];

// Navigation Handler
function handleNavigation(event) {
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
    }
}

async function initializeReviewTab() {
    try {
        completedTasks = await todoistService.getCompletedTasks();
        const insights = await openaiService.generateInsights(completedTasks, {
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
        
        // Get completed tasks for the last week
        const weeklyTasks = await todoistService.getCompletedTasks({
            since: lastWeek.toISOString()
        });
        
        // Group tasks by day
        const tasksByDay = weeklyTasks.reduce((acc, task) => {
            const date = new Date(task.completed_date).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        
        // Create chart data
        const chartData = {
            labels: Object.keys(tasksByDay),
            datasets: [{
                label: 'Tasks Completed',
                data: Object.values(tasksByDay),
                borderColor: '#e44332',
                tension: 0.4,
                fill: false
            }]
        };
        
        // Update or create chart
        if (!tasksChart) return;
        
        const ctx = tasksChart.getContext('2d');
        analyticsService.createTaskCompletionChart('tasksChart', {
            labels: chartData.labels,
            values: chartData.datasets[0].data
        });
        
        // Update metrics
        const productivityScore = analyticsService.calculateProductivityScore([...tasks, ...weeklyTasks]);
        document.querySelector('.metric-value').textContent = productivityScore;
        
    } catch (error) {
        console.error('Error initializing trends:', error);
    }
}

// Event Handlers
async function handleGeneratePlan() {
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
    }
}

async function handleSendEmail(templateId) {
    try {
        const template = await getEmailTemplate(templateId);
        await emailService.sendEmail(
            localStorage.getItem('user_email'),
            template.subject,
            template.content
        );
        alert('Email sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error);
        alert('Failed to send email. Please try again.');
    }
}

// Helper Functions
function getEmailTemplate(templateId) {
    // This would typically come from a server, but for now we'll use static templates
    const templates = {
        1: {
            subject: 'Daily Productivity Summary',
            content: `
                <h1>Your Daily Summary</h1>
                <p>Tasks completed today: ${completedTasks.length}</p>
                <p>Upcoming tasks: ${tasks.length}</p>
            `
        },
        2: {
            subject: 'Weekly Productivity Report',
            content: `
                <h1>Your Weekly Report</h1>
                <p>Weekly progress overview...</p>
            `
        },
        3: {
            subject: 'Monthly Productivity Review',
            content: `
                <h1>Your Monthly Review</h1>
                <p>Monthly achievements and insights...</p>
            `
        }
    };
    return templates[templateId];
}

// Initialize Application
function initializeApp() {
    // Add event listeners to navigation items
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Initialize first tab
    initializePlanTab();
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
