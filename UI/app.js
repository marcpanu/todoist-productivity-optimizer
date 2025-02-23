// API Service Configuration
const API_CONFIG = {
    TODOIST_API_URL: 'https://api.todoist.com/rest/v2',
    OPENAI_API_URL: 'https://api.openai.com/v1',
    GMAIL_API_URL: 'https://gmail.googleapis.com/gmail/v1',
    GCAL_API_URL: 'https://www.googleapis.com/calendar/v3',
    LOCAL_API_URL: 'https://your-vercel-url.com'
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

    async generatePlan(tasks) {
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
                        content: `Please create a plan for these tasks: ${JSON.stringify(tasks)}`
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
        const container = document.getElementById(containerId);
        if (!container) return;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: data.values,
                    borderColor: '#FF4B4B',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });

        this.chartInstances.set(containerId, chart);
        return chart;
    }
}

// Initialize services (moved to DOMContentLoaded)
let todoistService;
let openaiService;
let analyticsService;

// Function to check Todoist connection status
async function checkTodoistConnection() {
    const status = document.getElementById('todoist-status');
    const connectBtn = document.getElementById('todoist-connect');
    const disconnectBtn = document.getElementById('todoist-disconnect');
    const userInfo = document.getElementById('todoist-user-info');
    const userEmail = document.getElementById('todoist-email');
    const errorDiv = document.getElementById('todoist-error');
    
    if (!status || !connectBtn || !disconnectBtn || !userInfo || !userEmail || !errorDiv) return;
    
    // Reset UI state
    status.textContent = 'Checking...';
    errorDiv.style.display = 'none';
    userInfo.style.display = 'none';
    connectBtn.disabled = true;
    disconnectBtn.disabled = true;
    
    try {
        const response = await fetch('/auth/status/todoist', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to check Todoist status');
        }
        
        const data = await response.json();
        
        if (data.connected && data.user) {
            status.textContent = 'Connected';
            status.classList.add('connected');
            userInfo.style.display = 'block';
            userEmail.textContent = data.user.email;
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
            disconnectBtn.disabled = false;
        } else {
            status.textContent = 'Not Connected';
            status.classList.remove('connected');
            userInfo.style.display = 'none';
            connectBtn.style.display = 'block';
            connectBtn.disabled = false;
            disconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Todoist connection:', error);
        status.textContent = 'Error';
        status.classList.remove('connected');
        errorDiv.style.display = 'block';
        errorDiv.querySelector('.error-message').textContent = 'Failed to check connection status';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        connectBtn.disabled = false;
    }
}

// Function to check Google connection status
async function checkGoogleConnection() {
    const status = document.getElementById('google-status');
    const connectBtn = document.getElementById('google-connect');
    const disconnectBtn = document.getElementById('google-disconnect');
    const userInfo = document.getElementById('google-user-info');
    const userEmail = document.getElementById('google-email');
    const errorDiv = document.getElementById('google-error');
    
    if (!status || !connectBtn || !disconnectBtn || !userInfo || !userEmail || !errorDiv) return;
    
    // Reset UI state
    status.textContent = 'Checking...';
    errorDiv.style.display = 'none';
    userInfo.style.display = 'none';
    connectBtn.disabled = true;
    disconnectBtn.disabled = true;
    
    try {
        const response = await fetch('/auth/status/google', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to check Google status');
        }
        
        const data = await response.json();
        
        if (data.connected && data.user) {
            status.textContent = 'Connected';
            status.classList.add('connected');
            userInfo.style.display = 'block';
            userEmail.textContent = data.user.email;
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
            disconnectBtn.disabled = false;
        } else {
            status.textContent = 'Not Connected';
            status.classList.remove('connected');
            userInfo.style.display = 'none';
            connectBtn.style.display = 'block';
            connectBtn.disabled = false;
            disconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Google connection:', error);
        status.textContent = 'Error';
        status.classList.remove('connected');
        errorDiv.style.display = 'block';
        errorDiv.querySelector('.error-message').textContent = 'Failed to check connection status';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        connectBtn.disabled = false;
    }
}

// Function to handle Todoist connection
function connectTodoist() {
    const connectBtn = document.getElementById('todoist-connect');
    if (connectBtn) connectBtn.disabled = true;
    window.location.href = '/auth/todoist/connect';
}

// Function to handle Google connection
function connectGoogle() {
    const connectBtn = document.getElementById('google-connect');
    if (connectBtn) connectBtn.disabled = true;
    window.location.href = '/auth/google/connect';
}

// Function to handle Todoist disconnection
async function disconnectTodoist() {
    const status = document.getElementById('todoist-status');
    const disconnectBtn = document.getElementById('todoist-disconnect');
    const errorDiv = document.getElementById('todoist-error');
    
    if (!status || !disconnectBtn || !errorDiv) return;
    
    status.textContent = 'Disconnecting...';
    disconnectBtn.disabled = true;
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch('/auth/todoist/disconnect', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to disconnect Todoist');
        }
        
        await checkTodoistConnection();
    } catch (error) {
        console.error('Error disconnecting Todoist:', error);
        status.textContent = 'Error';
        errorDiv.style.display = 'block';
        errorDiv.querySelector('.error-message').textContent = 'Failed to disconnect';
        disconnectBtn.disabled = false;
    }
}

// Function to handle Google disconnection
async function disconnectGoogle() {
    const status = document.getElementById('google-status');
    const disconnectBtn = document.getElementById('google-disconnect');
    const errorDiv = document.getElementById('google-error');
    
    if (!status || !disconnectBtn || !errorDiv) return;
    
    status.textContent = 'Disconnecting...';
    disconnectBtn.disabled = true;
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch('/auth/google/disconnect', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to disconnect Google');
        }
        
        await checkGoogleConnection();
    } catch (error) {
        console.error('Error disconnecting Google:', error);
        status.textContent = 'Error';
        errorDiv.style.display = 'block';
        errorDiv.querySelector('.error-message').textContent = 'Failed to disconnect';
        disconnectBtn.disabled = false;
    }
}

// Function to handle app logout
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            console.error('Failed to logout');
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Navigation Handler
function handleNavigation(event) {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => item.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const clickedItem = event.currentTarget;
    clickedItem.classList.add('active');
    
    const tabId = clickedItem.dataset.tab;
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Tab Initialization Functions
function initializePlanTab() {
    const tasksList = document.getElementById('tasks-list');
    if (!tasksList) return;
    
    todoistService.getTasks()
        .then(tasks => {
            tasksList.innerHTML = tasks.map(task => `
                <div class="task-item">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                    <span>${task.content}</span>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error fetching tasks:', error);
            tasksList.innerHTML = '<div class="error">Error loading tasks. Please check your connection.</div>';
        });
}

// Event Handlers
async function handleGeneratePlan() {
    const tasksList = document.getElementById('tasks-list');
    if (!tasksList) return;

    try {
        const tasks = await todoistService.getTasks();
        const plan = await openaiService.generatePlan(tasks);
        
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

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize services
        todoistService = new TodoistService(localStorage.getItem('todoist_token'));
        openaiService = new OpenAIService(localStorage.getItem('openai_token'));
        analyticsService = new AnalyticsService();

        // Set up navigation
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems) {
            navItems.forEach(item => {
                if (item) {
                    item.addEventListener('click', handleNavigation);
                    // Check connections when profile tab is clicked
                    if (item.dataset.tab === 'profile-tab') {
                        item.addEventListener('click', () => {
                            checkTodoistConnection();
                            checkGoogleConnection();
                        });
                    }
                }
            });
        }

        // Set up connection buttons
        const todoistConnect = document.getElementById('todoist-connect');
        const todoistDisconnect = document.getElementById('todoist-disconnect');
        const googleConnect = document.getElementById('google-connect');
        const googleDisconnect = document.getElementById('google-disconnect');

        if (todoistConnect) todoistConnect.addEventListener('click', connectTodoist);
        if (todoistDisconnect) todoistDisconnect.addEventListener('click', disconnectTodoist);
        if (googleConnect) googleConnect.addEventListener('click', connectGoogle);
        if (googleDisconnect) googleDisconnect.addEventListener('click', disconnectGoogle);

        // Initialize first tab
        const currentTab = document.querySelector('.nav-item.active');
        if (currentTab && currentTab.dataset.tab === 'plan-tab') {
            initializePlanTab();
        }

        // Initial connection check if on profile tab
        if (currentTab && currentTab.dataset.tab === 'profile-tab') {
            checkTodoistConnection();
            checkGoogleConnection();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});
