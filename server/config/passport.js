const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const User = require('../models/User');
const axios = require('axios');

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
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

        const todoistUser = response.data;

        // Find or create user
        let user = await User.findOne({ todoistId: todoistUser.id });
        
        if (!user) {
            user = await User.create({
                email: todoistUser.email,
                name: todoistUser.full_name,
                todoistId: todoistUser.id.toString(),
                todoistAccessToken: accessToken
            });
        } else {
            // Update access token
            user.todoistAccessToken = accessToken;
            await user.save();
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
});

passport.use('todoist', todoistStrategy);

module.exports = passport;
