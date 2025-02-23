const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting configuration
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 attempts per window per IP
    message: 'Too many login attempts, please try again later'
});

const apiLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100
});

// Session configuration
const sessionConfig = {
    name: 'productivity-optimizer.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.COOKIE_DOMAIN,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// Token encryption
const ENCRYPTION_KEY = crypto.scryptSync(process.env.SESSION_SECRET, 'salt', 32);
const IV_LENGTH = 16;

function encryptToken(token) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(token), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptToken(encrypted) {
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}

// Security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.todoist.com', 'https://www.googleapis.com'],
            frameSrc: ["'self'", 'https://accounts.google.com'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false, // Required for Google OAuth
    crossOriginResourcePolicy: { policy: "cross-origin" }
});

module.exports = {
    authLimiter,
    apiLimiter,
    sessionConfig,
    encryptToken,
    decryptToken,
    securityHeaders
};
