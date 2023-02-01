// eslint-disable-next-line import/no-unassigned-import
require('#config/env');

const process = require('process');
const os = require('os');
const { parentPort } = require('worker_threads');

// eslint-disable-next-line import/no-unassigned-import
require('#config/mongoose');

const Graceful = require('@ladjs/graceful');
const _ = require('lodash');
const dayjs = require('dayjs-with-plugins');
const pMap = require('p-map');
const mongoose = require('mongoose');

const Users = require('#models/user');
const Domains = require('#models/domain');
const config = require('#config');
const logger = require('#helpers/logger');
const setupMongoose = require('#helpers/setup-mongoose');
const email = require('#helpers/email');

const concurrency = os.cpus().length;

const graceful = new Graceful({
  mongooses: [mongoose],
  logger
});
const threeMonthsAgo = dayjs().subtract(3, 'months').toDate();

// store boolean if the job is cancelled
let isCancelled = false;

// handle cancellation (this is a very simple example)
if (parentPort)
  parentPort.once('message', (message) => {
    //
    // TODO: once we can manipulate concurrency option to p-map
    // we could make it `Number.MAX_VALUE` here to speed cancellation up
    // <https://github.com/sindresorhus/p-map/issues/28>
    //
    if (message === 'cancel') isCancelled = true;
  });

graceful.listen();

async function mapper(_id) {
  // return early if the job was already cancelled
  if (isCancelled) return;

  try {
    const user = await Users.findById(_id).lean().exec();

    // user could have been deleted in the interim
    if (!user) return;

    // check if they already enabled it
    // in the interim if so return early
    if (user[config.passport.fields.otpEnabled]) return;

    // if the email was sent within the past 3 months
    if (
      _.isDate(user[config.userFields.twoFactorReminderSentAt]) &&
      dayjs(user[config.userFields.twoFactorReminderSentAt]).isAfter(
        dayjs().subtract(3, 'months')
      )
    )
      return;

    // send email
    await email({
      template: 'two-factor-reminder',
      message: {
        to: user[config.userFields.fullEmail]
      },
      locals: { user }
    });

    // store that we sent this email
    await Users.findByIdAndUpdate(user._id, {
      $set: {
        [config.userFields.twoFactorReminderSentAt]: new Date()
      }
    });
  } catch (err) {
    logger.error(err);
  }
}

(async () => {
  await setupMongoose(logger);

  const _ids = await Domains.distinct('members.user', {
    plan: {
      $ne: 'free'
    }
  });

  // filter for users that do not have two-factor auth set up yet
  const userIds = await Users.distinct('_id', {
    $and: [
      {
        _id: { $in: _ids },
        [config.userFields.hasVerifiedEmail]: true,
        [config.userFields.isBanned]: false
      },
      {
        $or: [
          {
            [config.userFields.twoFactorReminderSentAt]: {
              $exists: false
            }
          },
          {
            [config.userFields.twoFactorReminderSentAt]: {
              $lte: threeMonthsAgo
            }
          }
        ]
      },
      {
        [config.passport.fields.otpEnabled]: false
      }
    ]
  });

  logger.info('sending reminders', { count: userIds.length, _ids });

  // send emails and update `two_factor_reminder_sent_at` date
  await pMap(userIds, mapper, { concurrency });

  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
