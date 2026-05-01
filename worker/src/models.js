const mongoose = require('mongoose');

const Notification = require('../../shared/models/Notification')(mongoose);
const User         = require('../../shared/models/User')(mongoose);

module.exports = { Notification, User };
