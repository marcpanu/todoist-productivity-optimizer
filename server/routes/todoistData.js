const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get user info
router.get('/user', async (req, res) => {
    try {
        const response = await axios.get('https://api.todoist.com/sync/v9/user', {
            headers: {
                'Authorization': `Bearer ${req.user.accessToken}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Todoist API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch Todoist data',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;
