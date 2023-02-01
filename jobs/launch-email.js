// eslint-disable-next-line import/no-unassigned-import
require('#config/env');

const process = require('process');
const { parentPort } = require('worker_threads');

// eslint-disable-next-line import/no-unassigned-import
require('#config/mongoose');

const Graceful = require('@ladjs/graceful');

const mongoose = require('mongoose');
const config = require('#config');
const email = require('#helpers/email');
const logger = require('#helpers/logger');
const setupMongoose = require('#helpers/setup-mongoose');
const Users = require('#models/users');

const graceful = new Graceful({
  mongooses: [mongoose],
  logger
});

graceful.listen();

(async () => {
  await setupMongoose(logger);

  const object = {
    created_at: {
      $lte: config.launchDate
    }
  };
  object[config.userFields.launchEmailSentAt] = { $exists: false };
  object[config.userFields.hasVerifiedEmail] = true;

  const _ids = await Users.distinct('_id', object);

  // send launch email (in serial)
  for (const _id of _ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const user = await Users.findById(_id);

      // in case user deleted their account or is banned
      if (!user || user[config.userFields.isBanned]) continue;

      // in case email was sent for whatever reason
      if (user[config.userFields.launchEmailSentAt]) continue;

      // send email
      // eslint-disable-next-line no-await-in-loop
      await email({
        template: 'launch',
        message: {
          to: user[config.userFields.fullEmail]
        },
        locals: { user: user.toObject() }
      });

      // store that we sent this email
      // eslint-disable-next-line no-await-in-loop
      await Users.findByIdAndUpdate(user._id, {
        $set: {
          [config.userFields.launchEmailSentAt]: new Date()
        }
      });
      // eslint-disable-next-line no-await-in-loop
      await user.save();
    } catch (err) {
      logger.error(err);
    }
  }

  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
