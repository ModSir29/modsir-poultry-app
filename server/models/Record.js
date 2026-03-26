const mongoose = require('mongoose');

// A generic schema design that can handle all our various record types flexibly, 
// cleanly isolated by farmId.
const recordSchema = new mongoose.Schema({
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    type: { 
        type: String, 
        required: true, 
        enum: ['batches', 'flocks', 'feedPurchases', 'feedUsage', 'eggProduction', 'mortality', 'expenses', 'income', 'sales'] 
    },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Indexing by farmId and type is crucial for fast multi-tenant queries
recordSchema.index({ farmId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Record', recordSchema);
