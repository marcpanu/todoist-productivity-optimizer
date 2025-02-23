const express = require('express');
const passport = require('passport');
const router = express.Router();
const { tokenManager } = require('../config/oauth');
const bcrypt = require('bcryptjs');

// In-memory user store (replace with database in production)
const users = new Map();

// Initialize with a default user (replace with proper user management)
const initializeDefaultUser = async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.DEFAULT_PASSWORD || 'todoist2025', salt);
    users.set(process.env.DEFAULT_USERNAME || 'marcpanu', {
        username: process.env.DEFAULT_USERNAME || 'marcpanu',
        password: hashedPassword
    });
};
initializeDefaultUser();

// Status endpoints with proper error handling
router.get('/status/app', (req, res) => {
    try {
        res.json({
            authenticated: !!req.session.userId
        });
    } catch (error) {
        console.error('Error checking app status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/status/todoist', (req, res) => {
    try {
        res.json({
            connected: !!req.user?.id,
            user: req.user ? {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            } : null
        });
    } catch (error) {
        console.error('Error checking Todoist status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/status/google', (req, res) => {
    try {
        const connected = !!req.user?.googleId;
        res.json({
            connected: connected,
            user: req.user ? {
                id: req.user.googleId,
                email: req.user.googleEmail,
                name: req.user.googleName
            } : null
        });
    } catch (error) {
        console.error('Error checking Google status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// App authentication with secure password comparison
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.get(username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = username;
        res.json({ success: true });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Secure logout with proper session and token cleanup
router.post('/logout', async (req, res) => {
    try {
        // Clean up service tokens if they exist
        if (req.user) {
            if (req.user.id) {
                tokenManager.removeToken(req.user.id, 'todoist');
            }
            if (req.user.googleId) {
                tokenManager.removeToken(req.user.googleId, 'google');
            }
        }

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            res.clearCookie('productivity-optimizer.sid');
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Todoist OAuth routes with state validation
router.get('/todoist/connect', (req, res, next) => {
    req.session.oauth2state = Math.random().toString(36).substring(2);
    next();
}, passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete'],
    state: (req) => req.session.oauth2state
}));

router.get('/todoist/callback',
    (req, res, next) => {
        if (!req.session.oauth2state || req.query.state !== req.session.oauth2state) {
            return res.redirect('/?auth=error&service=todoist&reason=invalid_state');
        }
        next();
    },
    passport.authenticate('todoist', { 
        failureRedirect: '/?auth=error&service=todoist',
        failureMessage: true
    }),
    (req, res) => {
        res.redirect('/?auth=success&service=todoist');
    }
);

// Secure service disconnection with proper token cleanup
router.post('/todoist/disconnect', async (req, res) => {
    try {
        if (req.user?.id) {
            // Remove Todoist token
            tokenManager.removeToken(req.user.id, 'todoist');
            
            // Remove Todoist properties from user
            const todoistProps = ['id', 'email', 'name', 'accessToken', 'refreshToken'];
            todoistProps.forEach(prop => {
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
    } catch (error) {
        console.error('Error disconnecting Todoist:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Google OAuth routes with state validation
router.get('/google/connect', (req, res, next) => {
    req.session.oauth2state = Math.random().toString(36).substring(2);
    next();
}, passport.authenticate('google', {
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ],
    state: (req) => req.session.oauth2state
}));

router.get('/google/callback',
    (req, res, next) => {
        if (!req.session.oauth2state || req.query.state !== req.session.oauth2state) {
            return res.redirect('/?auth=error&service=google&reason=invalid_state');
        }
        next();
    },
    passport.authenticate('google', { 
        failureRedirect: '/?auth=error&service=google',
        failureMessage: true
    }),
    (req, res) => {
        res.redirect('/?auth=success&service=google');
    }
);

router.post('/google/disconnect', async (req, res) => {
    try {
        if (req.user?.googleId) {
            // Remove Google token
            tokenManager.removeToken(req.user.googleId, 'google');
            
            // Remove Google properties from user
            const googleProps = ['googleId', 'googleEmail', 'googleName', 'googleAccessToken', 'googleRefreshToken'];
            googleProps.forEach(prop => {
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
    } catch (error) {
        console.error('Error disconnecting Google:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
