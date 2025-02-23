require('dotenv').config({
    path: '.env'
});

// Import dependencies
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const path = require('path');
const { google } = require('googleapis');

// Import routes
const authRouter = require('./routes/auth');
const openaiRouter = require('./routes/openai');
const todoistDataRouter = require('./routes/todoistData');
const googleCalendarRouter = require('./routes/googleCalendar');
const googleGmailRouter = require('./routes/googleGmail');

// Initialize express app
const app = express();

// Trust Vercel's proxy
app.set('trust proxy', 1);

// Configure rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 50 // limit each IP to 50 requests per windowMs
});

// Session configuration
const sessionConfig = {
    name: 'productivity-optimizer.sid', // Specific name for our session cookie
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,  // Always use secure in production
        sameSite: 'none',  // Required for cross-site cookie in production
        domain: '.vercel.app',  // Set domain for Vercel
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

// Debug logging middleware
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query
    });
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
    origin: 'https://todoist-productivity-optimizer.vercel.app',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Passport session serialization
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

// Google OAuth2 strategy
function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',  // Updated to match our URL pattern
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Store tokens
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        // Create user object with Google info
        const user = {
            googleId: profile.id,
            googleEmail: profile.emails[0].value,
            googleName: profile.displayName,
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken
        };

        console.log('Google OAuth callback user:', user);
        return done(null, user);
    } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        return done(error);
    }
}));

// Mount API routes
app.use('/auth', authRouter);  // Auth router (login, OAuth flows)
app.use('/ai', requireAppLogin, openaiRouter);  // AI routes require app login
app.use('/todoist/data', requireAppLogin, requireTodoistAuth, todoistDataRouter);
app.use('/google/calendar', requireAppLogin, requireGoogleAuth, googleCalendarRouter);
app.use('/google/gmail', requireAppLogin, requireGoogleAuth, googleGmailRouter);

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
