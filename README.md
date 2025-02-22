# Productivity Optimizer

A web application that integrates with Todoist to provide enhanced productivity insights and task management optimization.

## Project Overview

### Phase 1: Infrastructure Setup
- Set up Express.js server with necessary middleware
- Configured secure session management
- Implemented OAuth2 authentication flow with Todoist
- Set up Vercel deployment pipeline
- Added security measures (helmet, CORS, secure cookies)

### Phase 2: Todoist Integration
- Implemented comprehensive Todoist data fetching using Sync API v9
- Enhanced data processing:
  - Human-readable project names
  - Section information
  - Label management
  - Task organization
- Added authentication middleware
- Implemented secure session handling
- Added debug and health check endpoints

## Tech Stack
- **Backend**: Node.js, Express.js
- **Authentication**: Passport.js (OAuth2)
- **API Integration**: Todoist API (Sync v9)
- **Security**: Helmet.js, CORS
- **Session Management**: express-session
- **Deployment**: Vercel

## API Endpoints

### Authentication
- `GET /api/auth/todoist`: Start Todoist OAuth flow
- `GET /api/auth/todoist/callback`: OAuth callback handler
- `POST /api/auth/logout`: User logout

### Todoist Data
- `GET /api/todoist/data`: Comprehensive data endpoint that returns:
  - Tasks with project and section names
  - Projects with colors and view styles
  - Sections with project associations
  - Labels with colors

### System
- `GET /api/debug/session`: Session state (development only)
- `GET /api/health`: Health check endpoint

## Environment Variables
```
TODOIST_CLIENT_ID=your_client_id
TODOIST_CLIENT_SECRET=your_client_secret
TODOIST_REDIRECT_URI=https://todoist-productivity-optimizer.vercel.app/api/auth/todoist/callback
SESSION_SECRET=your_session_secret
NODE_ENV=development
```

## Security Features
- CORS configuration with specific origin
- Secure session cookies
- HTTP security headers via Helmet
- OAuth2 authentication
- Session-based authentication checks
- HTTPS-only in production

## Future Phases
- Phase 3: Data Analysis & Insights
- Phase 4: Task Optimization Suggestions
- Phase 5: Advanced Productivity Features
