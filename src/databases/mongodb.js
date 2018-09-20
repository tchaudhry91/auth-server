import { logger } from '../utils/logger';

import config from '../config';
const mongoose = require('mongoose');

mongoose.Promise = Promise;

const reconnectTimeout = config.mongo.reconnectTimeout;

function connect() {
  mongoose
    .connect(
      config.mongo.uri + '/' + config.mongo.db,
      {
        autoReconnect: true,
        useNewUrlParser: true
      }
    )
    .catch(() => {});

  // mongoose.set('useCreateIndex', true);

  if (config.db_debug_log) {
    mongoose.set('debug', true);
  }
}

module.exports = () => {
  const db = mongoose.connection;

  db.on('connecting', () => {
    logger.info('Connecting to MongoDB...');
  });

  db.on('error', err => {
    logger.error(`MongoDB connection error: ${err}`);
    mongoose.disconnect();
  });

  db.on('connected', () => {
    logger.info('Connected to MongoDB!');
  });

  db.once('open', () => {
    logger.info('MongoDB connection opened!');
  });

  db.on('reconnected', () => {
    logger.info('MongoDB reconnected!');
  });

  db.on('disconnected', () => {
    logger.error(
      `MongoDB disconnected! Reconnecting in ${reconnectTimeout / 1000}s...`
    );
    setTimeout(() => connect(), reconnectTimeout);
  });

  connect();
};
