const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const router = express.Router();

// Initialize OAuth2 client
function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

// Initialize API clients on demand
function getCalendarClient() {
    return google.calendar({ version: 'v3', auth: getOAuth2Client() });
}

function getGmailClient() {
    return google.gmail({ version: 'v1', auth: getOAuth2Client() });
}

// Google OAuth2 strategy
passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI,
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.readonly'
    ]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Store tokens
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        const user = {
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            accessToken,
            refreshToken
        };

        console.log('Google OAuth callback user:', user);
        return done(null, user);
    } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        return done(error);
    }
}));

// Auth routes
router.get('/auth', passport.authenticate('google'));

router.get('/auth/callback',
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

// Calendar endpoints
router.get('/calendar/events', async (req, res) => {
    try {
        const calendar = getCalendarClient();
        // Set credentials from user session
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: req.user.accessToken,
            refresh_token: req.user.refreshToken
        });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        res.json(response.data.items);
    } catch (error) {
        console.error('Calendar API Error:', error);
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
});

// Gmail endpoints
router.get('/gmail/messages', async (req, res) => {
    try {
        const gmail = getGmailClient();
        // Set credentials from user session
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: req.user.accessToken,
            refresh_token: req.user.refreshToken
        });

        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: 'is:unread'
        });
        
        // Get details for each message
        const messages = await Promise.all(
            response.data.messages.map(async (msg) => {
                const details = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });
                return details.data;
            })
        );
        
        res.json(messages);
    } catch (error) {
        console.error('Gmail API Error:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail messages' });
    }
});

// Connection status endpoint
router.get('/status', (req, res) => {
    const user = req.user;
    res.json({
        connected: !!user?.googleId,
        email: user?.email,
        name: user?.name
    });
});

module.exports = router;
