require('dotenv').config({
    path: '.env'
});

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');

// Initialize express app
const app = express();

// Import routes
const openaiRouter = require('./openai');

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

const corsOptions = {
    origin: 'https://todoist-productivity-optimizer.vercel.app',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from UI directory
app.use(express.static(path.join(__dirname, '..', 'UI')));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: true,
    saveUninitialized: true,
    store: new session.MemoryStore(),
    proxy: true,
    cookie: {
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000,
        domain: 'todoist-productivity-optimizer.vercel.app'
    }
};

app.set('trust proxy', 1);

// Initialize passport and session
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Mount OpenAI routes
app.use('/api/ai', isAuthenticated, openaiRouter);

// Initialize passport
// Passport configuration
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user);
    done(null, user);
});

passport.deserializeUser((user, done) => {
    console.log('Deserializing user:', user);
    done(null, user);
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
    passport.authenticate('todoist', {
        failureRedirect: '/login.html',
        failureMessage: true
    }),
    (req, res) => {
        console.log('OAuth callback success, user:', req.user);
        res.redirect('/');
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
