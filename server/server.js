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

// Initialize express app
const app = express();

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? 'https://todoist-productivity-optimizer.vercel.app'
        : 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
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
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { accessToken });
});

passport.use('todoist', todoistStrategy);

// Auth routes
app.get('/api/auth/todoist', passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete']
}));

app.get('/api/auth/todoist/callback',
    passport.authenticate('todoist', {
        failureRedirect: '/login',
        failureMessage: true
    }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

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
