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

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// Middleware to check if user is logged into the app
const requireAppLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'App login required' });
    }
    next();
};

// Middleware to check service-specific auth
const requireTodoistAuth = (req, res, next) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Todoist authentication required' });
    }
    next();
};

const requireGoogleAuth = (req, res, next) => {
    if (!req.user?.googleId) {
        return res.status(401).json({ error: 'Google authentication required' });
    }
    next();
};

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Basic app login endpoint (temporary - should be replaced with proper auth)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // In production, this should use a secure password hash and database
    const VALID_USERNAME = 'marcpanu';
    const VALID_PASSWORD = 'todoist2025';

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        req.session.userId = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Mount API routes
app.use('/api/ai', openaiRouter);
app.use('/api/todoist/data', requireAppLogin, requireTodoistAuth, googleRouter);
app.use('/api/google', requireAppLogin, requireGoogleAuth, googleRouter);

// Auth routes (no app login required)
app.use('/auth/todoist', passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete']
}));

app.get('/auth/todoist/callback',
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

app.use('/auth/google', passport.authenticate('google'));

// Protected app routes (require app login)
app.get('/api/todoist/user', requireAppLogin, async (req, res) => {
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

// Auth check endpoint
app.get('/api/auth/check', (req, res) => {
    res.json({
        authenticated: !!req.session.userId,
        connections: {
            todoist: !!req.user?.id,
            google: !!req.user?.googleId
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
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
