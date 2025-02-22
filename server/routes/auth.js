const express = require('express');
const passport = require('passport');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Not authenticated' });
};

// Start Todoist OAuth flow
router.get('/todoist', passport.authenticate('todoist', {
    scope: ['data:read_write,data:delete']
}));

// Todoist OAuth callback
router.get('/todoist/callback',
    passport.authenticate('todoist', {
        failureRedirect: '/login',
        failureMessage: true
    }),
    (req, res) => {
        // Log the authentication success
        console.log('Todoist authentication successful');
        console.log('User:', req.user);
        
        // Redirect to the frontend dashboard
        res.redirect('/dashboard');
    }
);

// Get current user
router.get('/user', isAuthenticated, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
    });
});

// Check auth status
router.get('/status', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user ? {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
        } : null
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;
