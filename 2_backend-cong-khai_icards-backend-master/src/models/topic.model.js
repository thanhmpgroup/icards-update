// AdminBE/models/topic.model.js
const mongoose = require('mongoose');
const { slugify } = require('../utils/slugify');

const topicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên chủ đề là bắt buộc.'],
        trim: true,
        unique: true,
    },
    slug: {
        type: String,
        required: [true, 'Đường dẫn (slug) là bắt buộc.'],
        unique: true,
        trim: true,
        lowercase: true,
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

topicSchema.pre('validate', function(next) {
    if (!this.slug || this.isModified('slug')) {
        this.slug = slugify(this.slug || this.name);
    }
    next();
});

topicSchema.pre('save', async function(next) {
    if (this.isNew) {
        const highestOrderTopic = await this.constructor.findOne().sort('-order');
        this.order = (highestOrderTopic && typeof highestOrderTopic.order === 'number') ? highestOrderTopic.order + 1 : 1;
    }
    next();
});

const Topic = mongoose.model('Topic', topicSchema);

module.exports = Topic;