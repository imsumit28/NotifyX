const QUEUE_NAME = 'notification-queue';
const DLQ_NAME   = 'dlq-queue';
const CHANNEL_PREFIX = 'user:';

const DEFAULT_PREFERENCES = {
  inApp: true,
  email: false,
  push:  false,
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  mutedTypes: [],
};

const NOTIFICATION_TYPES = ['like', 'comment', 'follow', 'mention'];

// Types that go through the 30-second batch window (high-volume, low-urgency)
const BATCH_TYPES     = ['like', 'follow'];
const BATCH_WINDOW_S  = 30;   // flush window in seconds
const BATCH_THRESHOLD = 10;   // immediate flush if this many stack up

module.exports = { QUEUE_NAME, DLQ_NAME, CHANNEL_PREFIX, DEFAULT_PREFERENCES, NOTIFICATION_TYPES, BATCH_TYPES, BATCH_WINDOW_S, BATCH_THRESHOLD };
