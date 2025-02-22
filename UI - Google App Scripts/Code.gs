function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Productivity Optimizer')
    .setFaviconUrl('https://www.google.com/favicon.ico')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Task Management Functions
function getTasks() {
  // TODO: Implement Todoist API integration
  return [
    { id: 1, title: 'Complete project proposal', due: '2024-02-21', priority: 1 },
    { id: 2, title: 'Review weekly metrics', due: '2024-02-22', priority: 2 },
    { id: 3, title: 'Schedule team meeting', due: '2024-02-23', priority: 3 }
  ];
}

function generateDailyPlan() {
  // TODO: Implement OpenAI integration
  return {
    summary: 'Today\'s focus should be on completing high-priority tasks...',
    recommendations: [
      'Start with the project proposal',
      'Schedule the team meeting before lunch',
      'Review metrics in the afternoon'
    ]
  };
}

function generateReport(type) {
  // TODO: Implement report generation with OpenAI
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

function sendEmail(templateId) {
  // TODO: Implement Gmail integration
  return { success: true, message: 'Email sent successfully' };
}

function scheduleEmail(templateId, schedule) {
  // TODO: Implement email scheduling
  return { success: true, message: 'Email scheduled successfully' };
}

function getEmailTemplates() {
  return [
    { id: 1, name: 'Daily Summary', schedule: 'daily' },
    { id: 2, name: 'Weekly Report', schedule: 'weekly' },
    { id: 3, name: 'Monthly Review', schedule: 'monthly' }
  ];
}
