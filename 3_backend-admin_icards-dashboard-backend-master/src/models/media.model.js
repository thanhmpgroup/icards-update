const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileKey: { type: String, required: true }, // Key của R2 dùng để xóa
    mimetype: { type: String },
    size: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);