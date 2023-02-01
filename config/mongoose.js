const Mongoose = require('@ladjs/mongoose');
const mongoose = require('mongoose');

const logger = require('#helpers/logger');
const env = require('#config/env');

const connectionNameSymbol = Symbol.for('connection.name');
const m = new Mongoose({ logger });

// destroy initial connection
// <https://github.com/Automattic/mongoose/issues/12965>
const initialConnection = mongoose.connections.find((conn) => conn.id === 0);
if (initialConnection) initialConnection.destroy();

// <https://github.com/Automattic/mongoose/issues/12970>
for (const name of ['MONGO_URI', 'LOGS_MONGO_URI']) {
  const uri = env[name];
  if (mongoose.connections.some((conn) => conn._connectionString === uri))
    continue;
  const conn = m.createConnection(uri);
  // this is used in helpers/logger.js (so we don't expose env)
  conn[connectionNameSymbol] = name;
}
