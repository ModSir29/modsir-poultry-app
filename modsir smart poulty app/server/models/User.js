const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // will be specifically hashed before save
    role: { type: String, enum: ['admin', 'worker'], default: 'admin' },
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
