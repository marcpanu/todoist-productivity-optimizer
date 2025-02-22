// DOM Elements
const mainContent = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');
const tasksChart = document.getElementById('tasksChart');

// State Management
let currentTab = 'plan-tab';

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
        initializeTrendsChart();
    }
}

// Initialize Chart
function initializeTrendsChart() {
    if (!tasksChart) return;

    const ctx = tasksChart.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Tasks Completed',
                data: [12, 19, 3, 5, 2, 3, 7],
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
}

// Task Management
class TaskManager {
    constructor() {
        this.tasks = [];
    }

    async fetchTasks() {
        // TODO: Implement API call to fetch tasks from Todoist
        // For now, return mock data
        return [
            { id: 1, title: 'Complete project proposal', due: '2024-02-21', priority: 1 },
            { id: 2, title: 'Review weekly metrics', due: '2024-02-22', priority: 2 },
            { id: 3, title: 'Schedule team meeting', due: '2024-02-23', priority: 3 }
        ];
    }

    async generateDailyPlan() {
        // TODO: Implement OpenAI integration for plan generation
        return {
            summary: 'Today\'s focus should be on completing high-priority tasks...',
            recommendations: [
                'Start with the project proposal',
                'Schedule the team meeting before lunch',
                'Review metrics in the afternoon'
            ]
        };
    }
}

// Report Generation
class ReportGenerator {
    async generateReport(type) {
        // TODO: Implement OpenAI integration for report generation
        return {
            title: `${type} Report`,
            content: 'Your productivity has increased by 15% this week...',
            metrics: {
                tasksCompleted: 24,
                productivityScore: 8.5,
                overdueTasks: 2
            }
        };
    }
}

// Email Management
class EmailManager {
    constructor() {
        this.templates = [
            { id: 1, name: 'Daily Summary', schedule: 'daily' },
            { id: 2, name: 'Weekly Report', schedule: 'weekly' },
            { id: 3, name: 'Monthly Review', schedule: 'monthly' }
        ];
    }

    async sendEmail(templateId) {
        // TODO: Implement Gmail API integration
        console.log(`Sending email with template ${templateId}`);
    }

    async scheduleEmail(templateId, schedule) {
        // TODO: Implement email scheduling
        console.log(`Scheduling email with template ${templateId} for ${schedule}`);
    }
}

// Initialize Application
function initializeApp() {
    // Add event listeners to navigation items
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Initialize task manager
    const taskManager = new TaskManager();
    const reportGenerator = new ReportGenerator();
    const emailManager = new EmailManager();

    // Initialize first tab
    if (currentTab === 'trends-tab') {
        initializeTrendsChart();
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
