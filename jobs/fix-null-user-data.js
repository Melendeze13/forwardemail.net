// eslint-disable-next-line import/no-unassigned-import
require('#config/env');

const process = require('process');
const os = require('os');
const { parentPort } = require('worker_threads');

// eslint-disable-next-line import/no-unassigned-import
require('#config/mongoose');

const Graceful = require('@ladjs/graceful');
const pMap = require('p-map');

const mongoose = require('mongoose');
const Users = require('#models/users');
const logger = require('#helpers/logger');
const setupMongoose = require('#helpers/setup-mongoose');

const concurrency = os.cpus().length;
const graceful = new Graceful({
  mongooses: [mongoose],
  logger
});

graceful.listen();

(async () => {
  await setupMongoose();

  const $or = [];
  const props = [];

  for (const prop of Object.keys(Users.prototype.schema.paths)) {
    if (Users.prototype.schema.paths[prop].instance === 'String') {
      $or.push({
        [prop]: { $type: 10 }
      });
      props.push(prop);
    }
  }

  const count = await Users.countDocuments({ $or });
  console.log('count', count);

  const ids = await Users.distinct('_id', { $or });

  async function mapper(id) {
    const user = await Users.findById(id);
    if (!user) throw new Error('User does not exist');
    for (const prop of props) {
      if (user[prop] === null) {
        console.log(`User ${user.email} had null prop of ${prop}`);
        user[prop] = undefined;
      }
    }

    await user.save();
  }

  await pMap(ids, mapper, { concurrency });

  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
