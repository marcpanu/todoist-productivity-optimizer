const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    todoistId: {
        type: String,
        required: true,
        unique: true
    },
    todoistAccessToken: {
        type: String,
        required: true
    },
    lastSync: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
