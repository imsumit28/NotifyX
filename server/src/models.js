const mongoose = require('mongoose');

const Notification = require('../../shared/models/Notification')(mongoose);
const User         = require('../../shared/models/User')(mongoose);
const ApiKey       = require('../../shared/models/ApiKey')(mongoose);

module.exports = { Notification, User, ApiKey };
