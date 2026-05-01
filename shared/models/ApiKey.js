module.exports = (mongoose) => {
  if (mongoose.models.ApiKey) return mongoose.models.ApiKey;

  const schema = new mongoose.Schema({
    keyHash:    { type: String, required: true, unique: true },
    prefix:     { type: String, required: true },
    appName:    { type: String, required: true },
    active:     { type: Boolean, default: true },
    lastUsedAt: { type: Date },
  }, { timestamps: true });

  return mongoose.model('ApiKey', schema);
};
