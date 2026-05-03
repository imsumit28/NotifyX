module.exports = (mongoose) => {
  if (mongoose.models.ApiKey) return mongoose.models.ApiKey;

  const schema = new mongoose.Schema({
    keyHash:    { type: String, required: true, unique: true },
    prefix:     { type: String, required: true },
    appName:    { type: String, required: true },
    active:     { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    // ownerId — the userId who created this key (null = admin-created)
    ownerId:    { type: String, default: null, index: true },
  }, { timestamps: true });

  return mongoose.model('ApiKey', schema);
};
