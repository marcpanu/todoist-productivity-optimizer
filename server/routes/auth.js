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

router.post('/todoist/disconnect', (req, res) => {
    if (req.user) {
        delete req.user.id;
        delete req.user.email;
        delete req.user.name;
        delete req.user.accessToken;
    }
    res.json({ success: true });
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

router.post('/google/disconnect', (req, res) => {
    if (req.user) {
        delete req.user.googleId;
        delete req.user.googleEmail;
        delete req.user.googleName;
        delete req.user.googleAccessToken;
        delete req.user.googleRefreshToken;
    }
    res.json({ success: true });
});

module.exports = router;
