module.exports = (mongoose) => {
  if (mongoose.models.Notification) return mongoose.models.Notification;

  const schema = new mongoose.Schema({
    recipientId:    { type: String, required: true, index: true },
    senderId:       { type: String, required: true },
    type:           { type: String, enum: ['like', 'comment', 'follow', 'mention'], required: true },
    payload:        { type: mongoose.Schema.Types.Mixed, default: {} },
    status:         { type: String, enum: ['unread', 'read'], default: 'unread' },
    delivered:      { type: Boolean, default: false },
    idempotencyKey: { type: String, unique: true, sparse: true },
    batchCount:     { type: Number, default: 1 },
    createdAt:      { type: Date, default: Date.now },
    readAt:         { type: Date, default: null },
  });

  schema.index({ recipientId: 1, createdAt: -1 });
  schema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

  return mongoose.model('Notification', schema);
};
