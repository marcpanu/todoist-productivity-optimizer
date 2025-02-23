const express = require('express');
const passport = require('passport');
const router = express.Router();

// Status endpoints
router.get('/status/app', (req, res) => {
    res.json({
        authenticated: !!req.session.userId
    });
});

router.get('/status/todoist', (req, res) => {
    res.json({
        connected: !!req.user?.id,
        user: req.user ? {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
        } : null
    });
});

router.get('/status/google', (req, res) => {
    res.json({
        connected: !!req.user?.googleId,
        user: req.user ? {
            id: req.user.googleId,
            email: req.user.googleEmail,
            name: req.user.googleName
        } : null
    });
});

// App authentication
router.post('/login', (req, res) => {
    console.log('Login attempt:', {
        receivedUsername: req.body.username,
        receivedPassword: req.body.password,
        validUsername: 'marcpanu',
        validPassword: 'todoist2025',
        body: req.body,
        session: req.session,
        headers: req.headers
    });

    const { username, password } = req.body;
    
    // In production, this should use a secure password hash and database
    const VALID_USERNAME = 'marcpanu';
    const VALID_PASSWORD = 'todoist2025';

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        console.log('Login successful');
        req.session.userId = username;
        console.log('Session after login:', req.session);
        res.json({ success: true });
    } else {
        console.log('Login failed');
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Todoist OAuth routes
router.get('/todoist/connect', passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete']
}));

router.get('/todoist/callback',
    (req, res, next) => {
        console.log('Received Todoist OAuth callback, query:', req.query);
        next();
    },
    passport.authenticate('todoist', { 
        failureRedirect: '/?auth=error&service=todoist',
        failureMessage: true
    }),
    (req, res) => {
        console.log('Todoist OAuth callback success, user:', req.user);
        res.redirect('/?auth=success&service=todoist');
    }
);

// Define Todoist-specific properties
const TODOIST_PROPERTIES = ['id', 'email', 'name', 'accessToken'];

router.post('/todoist/disconnect', (req, res) => {
    if (req.user) {
        // Remove all Todoist properties
        TODOIST_PROPERTIES.forEach(prop => {
            delete req.user[prop];
        });
        // Save changes to session
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session after Todoist disconnect:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
});

// Google OAuth routes
router.get('/google/connect', passport.authenticate('google', {
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ]
}));

router.get('/google/callback',
    (req, res, next) => {
        console.log('Received Google OAuth callback, query:', req.query);
        next();
    },
    passport.authenticate('google', { 
        failureRedirect: '/?auth=error&service=google',
        failureMessage: true
    }),
    (req, res) => {
        console.log('Google OAuth callback success, user:', req.user);
        res.redirect('/?auth=success&service=google');
    }
);

// Define Google-specific properties
const GOOGLE_PROPERTIES = ['googleId', 'googleEmail', 'googleName', 'googleAccessToken', 'googleRefreshToken'];

router.post('/google/disconnect', (req, res) => {
    if (req.user) {
        // Remove all Google properties
        GOOGLE_PROPERTIES.forEach(prop => {
            delete req.user[prop];
        });
        // Save changes to session
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session after Google disconnect:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
});

module.exports = router;
