const config = require('../config');
const mongoose = require('mongoose');

const log = require('../helpers/log');

mongoose.Promise = Promise;

const reconnectTimeout = config.mongo.reconnectTimeout;

function connect() {
  mongoose
    .connect(config.mongo.uri, {
      dbName: config.mongo.db,
      autoReconnect: true
    })
    .catch(() => {});
}

module.exports = () => {
  const db = mongoose.connection;

  db.on('connecting', () => {
    log.dev('Connecting to MongoDB...');
  });

  db.on('error', err => {
    log.error(`MongoDB connection error: ${err}`);
    mongoose.disconnect();
  });

  db.on('connected', () => {
    log.dev('Connected to MongoDB!');
  });

  db.once('open', () => {
    log.dev('MongoDB connection opened!');
  });

  db.on('reconnected', () => {
    log.dev('MongoDB reconnected!');
  });

  db.on('disconnected', () => {
    log.error(
      `MongoDB disconnected! Reconnecting in ${reconnectTimeout / 1000}s...`
    );
    setTimeout(() => connect(), reconnectTimeout);
  });

  connect();
};
