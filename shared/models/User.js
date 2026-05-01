module.exports = (mongoose) => {
  if (mongoose.models.User) return mongoose.models.User;

  const schema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    email:  { type: String },
    passwordHash: { type: String },
    preferences: {
      inApp:  { type: Boolean, default: true },
      email:  { type: Boolean, default: false },
      push:   { type: Boolean, default: false },
      quietHours: {
        enabled:   { type: Boolean, default: false },
        startHour: { type: Number,  default: 22 },
        endHour:   { type: Number,  default: 7 },
      },
      mutedTypes: { type: [String], default: [] },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  });

  return mongoose.model('User', schema);
};
