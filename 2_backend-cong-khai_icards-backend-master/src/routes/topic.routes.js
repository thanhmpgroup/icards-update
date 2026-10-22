// AdminBE/routes/topic.routes.js
const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Router này được gắn vào /api/public/topics nên mọi thao tác ghi phải yêu cầu quyền quản trị
const requireContentManager = [protect, authorize('admin', 'marketing')];

router.get('/public', topicController.getPublicTopics);

router.route('/')
    .get(topicController.getAllTopics)
    .post(requireContentManager, topicController.createTopic);

router.route('/update-order')
    .put(requireContentManager, topicController.updateTopicOrder);

router.route('/:id')
    .put(requireContentManager, topicController.updateTopic)
    .delete(requireContentManager, topicController.deleteTopic);

module.exports = router;
