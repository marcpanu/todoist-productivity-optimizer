require('dotenv').config({
    path: process.env.NODE_ENV === 'production' 
        ? '.env.vercel'
        : '.env.local'
});

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

// Initialize express app
const app = express();

// Middleware
app.use(helmet());
app.use(morgan('dev'));

const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? 'https://todoist-productivity-optimizer.vercel.app'
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: true,
    saveUninitialized: true,
    store: new session.MemoryStore(),
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        domain: process.env.NODE_ENV === 'production' 
            ? 'todoist-productivity-optimizer.vercel.app'
            : 'localhost'
    }
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

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

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

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
