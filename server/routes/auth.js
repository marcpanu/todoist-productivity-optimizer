const express = require('express');
const passport = require('passport');
const router = express.Router();

// Status endpoints
router.get('/status/app', (req, res) => {
    console.log('\n=== App Status Check ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('======================\n');

    res.json({
        authenticated: !!req.session.userId
    });
});

router.get('/status/todoist', (req, res) => {
    console.log('\n=== Todoist Status Check ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('=========================\n');

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
    console.log('\n=== Google Status Check ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('========================\n');

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
    console.log('\n=== App Login ===');
    console.log('Body:', req.body);
    console.log('Session before:', req.session);

    const { username, password } = req.body;
    
    // In production, this should use a secure password hash and database
    const VALID_USERNAME = 'marcpanu';
    const VALID_PASSWORD = 'todoist2025';

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        req.session.userId = username;
        console.log('Login successful');
        console.log('Session after:', req.session);
        res.json({ success: true });
    } else {
        console.log('Login failed');
        res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('=================\n');
});

router.post('/logout', (req, res) => {
    console.log('\n=== App Logout ===');
    console.log('Session before:', req.session);
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        console.log('Session destroyed');
        res.json({ success: true });
    });
    console.log('=================\n');
});

// Todoist OAuth routes
router.get('/todoist/connect', (req, res, next) => {
    console.log('\n=== Todoist Connect ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('=====================\n');
    next();
}, passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete']
}));

router.get('/todoist/callback',
    (req, res, next) => {
        console.log('\n=== Todoist Callback ===');
        console.log('Query:', req.query);
        console.log('Session:', req.session);
        console.log('User:', req.user);
        console.log('=====================\n');
        next();
    },
    passport.authenticate('todoist', { 
        failureRedirect: '/?auth=error&service=todoist',
        failureMessage: true
    }),
    (req, res) => {
        console.log('\n=== Todoist Callback Success ===');
        console.log('Session:', req.session);
        console.log('User:', req.user);
        console.log('============================\n');
        res.redirect('/?auth=success&service=todoist');
    }
);

// Define Todoist-specific properties
const TODOIST_PROPERTIES = ['id', 'email', 'name', 'accessToken'];

router.post('/todoist/disconnect', (req, res) => {
    console.log('\n=== Todoist Disconnect ===');
    console.log('Session before:', req.session);
    console.log('User before:', req.user);

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
            console.log('Session after:', req.session);
            console.log('User after:', req.user);
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
    console.log('========================\n');
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
        console.log('\n=== Google Callback ===');
        console.log('Query:', req.query);
        console.log('Session:', req.session);
        console.log('User:', req.user);
        console.log('=====================\n');
        next();
    },
    passport.authenticate('google', { 
        failureRedirect: '/?auth=error&service=google',
        failureMessage: true
    }),
    (req, res) => {
        console.log('\n=== Google Callback Success ===');
        console.log('Session:', req.session);
        console.log('User:', req.user);
        console.log('============================\n');
        res.redirect('/?auth=success&service=google');
    }
);

// Define Google-specific properties
const GOOGLE_PROPERTIES = ['googleId', 'googleEmail', 'googleName', 'googleAccessToken', 'googleRefreshToken'];

router.post('/google/disconnect', (req, res) => {
    console.log('\n=== Google Disconnect ===');
    console.log('Session before:', req.session);
    console.log('User before:', req.user);

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
            console.log('Session after:', req.session);
            console.log('User after:', req.user);
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
    console.log('========================\n');
});

module.exports = router;
