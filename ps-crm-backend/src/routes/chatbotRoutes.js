const express = require('express');
const router = express.Router();
const { chatWithBot } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/chat', chatWithBot);

module.exports = router;