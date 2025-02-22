require('dotenv').config({
    path: '.env'
});

// Import dependencies
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const axios = require('axios');
const path = require('path');

// Import routes
const openaiRouter = require('./openai');
const googleRouter = require('./google');

// Initialize express app
const app = express();

// Configure rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 50
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(limiter);

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://todoist-productivity-optimizer.vercel.app'
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from UI directory
app.use(express.static(path.join(__dirname, '..', 'UI')));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: 'todoist.sid',
    cookie: {
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        httpOnly: true
    }
};

app.set('trust proxy', 1);

// Debug middleware for session issues
app.use((req, res, next) => {
    console.log('Session Debug:', {
        sessionId: req.sessionID,
        hasSession: !!req.session,
        isAuthenticated: req.isAuthenticated?.(),
        cookies: req.cookies,
        path: req.path,
        headers: req.headers
    });
    next();
});

// Initialize passport and session
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user);
    done(null, user);
});

passport.deserializeUser((user, done) => {
    console.log('Deserializing user:', user);
    done(null, user);
});

// Mount API routes
app.use('/api/ai', isAuthenticated, openaiRouter);

// Split Google routes into auth and protected routes
const googleAuthRouter = express.Router();
googleAuthRouter.get('/auth', passport.authenticate('google'));
googleAuthRouter.get('/auth/callback', 
    passport.authenticate('google', { failWithError: true }),
    (req, res) => {
        console.log('Google OAuth callback success, saving session');
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/?auth=session-error');
            }
            console.log('Session saved successfully');
            res.redirect('/');
        });
    },
    (err, req, res, next) => {
        console.error('Google OAuth callback error:', err);
        res.redirect('/?auth=error');
    }
);
app.use('/api/google', googleAuthRouter);
app.use('/api/google', isAuthenticated, googleRouter);

// Auth check endpoint
app.get('/api/auth/check', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
        session: req.session,
        connections: {
            todoist: !!req.user?.id,
            google: !!req.user?.googleId
        }
    });
});

// Todoist OAuth2 strategy
const todoistStrategy = new OAuth2Strategy({
    authorizationURL: 'https://todoist.com/oauth/authorize',
    tokenURL: 'https://todoist.com/oauth/access_token',
    clientID: process.env.TODOIST_CLIENT_ID,
    clientSecret: process.env.TODOIST_CLIENT_SECRET,
    callbackURL: process.env.TODOIST_REDIRECT_URI,
    state: true
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Get user info from Todoist
        const response = await axios.get('https://api.todoist.com/sync/v9/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const user = {
            accessToken,
            id: response.data.id,
            email: response.data.email,
            name: response.data.full_name
        };
        
        console.log('OAuth callback user:', user);
        return done(null, user);
    } catch (error) {
        console.error('Error in OAuth callback:', error);
        return done(error);
    }
});

passport.use('todoist', todoistStrategy);

// Auth routes
app.get('/api/auth/todoist', (req, res, next) => {
    console.log('Starting OAuth flow');
    passport.authenticate('todoist', {
        scope: ['data:read_write,data:delete']
    })(req, res, next);
});

app.get('/api/auth/todoist/callback',
    (req, res, next) => {
        console.log('OAuth callback received, state:', req.query.state);
        next();
    },
    passport.authenticate('todoist', { failWithError: true }),
    (req, res) => {
        console.log('OAuth callback success, saving session');
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/?auth=session-error');
            }
            console.log('Session saved successfully');
            res.redirect('/');
        });
    },
    (err, req, res, next) => {
        console.error('OAuth callback error:', err);
        res.redirect('/?auth=error');
    }
);

// Test endpoint to get Todoist user data
app.get('/api/todoist/user', isAuthenticated, async (req, res) => {
    try {
        const response = await axios.get('https://api.todoist.com/sync/v9/user', {
            headers: {
                'Authorization': `Bearer ${req.user.accessToken}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Todoist API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch Todoist data',
            details: error.response?.data || error.message
        });
    }
});

// Todoist API endpoints
app.get('/api/todoist/data', isAuthenticated, async (req, res) => {
    try {
        // Get all resources in one call using sync API
        const syncResponse = await axios.post('https://api.todoist.com/sync/v9/sync', {
            sync_token: '*',
            resource_types: '["projects", "items", "sections", "labels"]'
        }, {
            headers: {
                'Authorization': `Bearer ${req.user.accessToken}`
            }
        });

        // Process the data to make it more readable
        const { projects, items, sections, labels } = syncResponse.data;

        // Create maps for quick lookups
        const projectMap = {};
        projects.forEach(project => {
            projectMap[project.id] = project.name;
        });

        const sectionMap = {};
        sections.forEach(section => {
            sectionMap[section.id] = {
                name: section.name,
                projectId: section.project_id
            };
        });

        const labelMap = {};
        labels.forEach(label => {
            labelMap[label.id] = label.name;
        });

        // Enhance tasks with readable project and section names
        const enhancedTasks = items.map(task => ({
            ...task,
            project_name: projectMap[task.project_id] || 'Unknown Project',
            section_name: task.section_id ? sectionMap[task.section_id]?.name : null,
            label_names: task.labels?.map(labelId => labelMap[labelId]) || []
        }));

        res.json({
            tasks: enhancedTasks,
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                view_style: p.view_style
            })),
            sections: sections.map(s => ({
                id: s.id,
                name: s.name,
                project_id: s.project_id,
                project_name: projectMap[s.project_id]
            })),
            labels: labels.map(l => ({
                id: l.id,
                name: l.name,
                color: l.color
            }))
        });
    } catch (error) {
        console.error('Todoist API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch Todoist data',
            details: error.response?.data || error.message
        });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

// Debug endpoint to check session
app.get('/api/debug/session', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
        session: req.session
    });
});

// Todoist user status endpoint
app.get('/api/todoist/user', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email
            }
        });
    } else {
        res.status(401).json({
            authenticated: false
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
