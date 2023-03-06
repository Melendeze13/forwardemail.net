const Boom = require('@hapi/boom');
const _ = require('lodash');
const captainHook = require('captain-hook');
const countryList = require('country-list');
const cryptoRandomString = require('crypto-random-string');
const dayjs = require('dayjs-with-plugins');
const isFQDN = require('is-fqdn');
const isSANB = require('is-string-and-not-blank');
const mongoose = require('mongoose');
const mongooseCommonPlugin = require('mongoose-common-plugin');
const mongooseOmitCommonFields = require('mongoose-omit-common-fields');
const ms = require('ms');
const passportLocalMongoose = require('passport-local-mongoose');
const sanitizeHtml = require('sanitize-html');
const striptags = require('striptags');
const validator = require('validator');
const { authenticator } = require('otplib');
const { boolean } = require('boolean');
const { request } = require('undici');

// <https://github.com/Automattic/mongoose/issues/5534>
mongoose.Error.messages = require('@ladjs/mongoose-error-messages');

const Payments = require('./payments');

const logger = require('#helpers/logger');
const config = require('#config');
const i18n = require('#helpers/i18n');

if (config.passportLocalMongoose.usernameField !== 'email') {
  throw new Error(
    'User model and @ladjs/passport requires that the usernameField is email.'
  );
}

const countries = countryList.getNames().sort();
const options = { length: 10, type: 'numeric' };
const { fields } = config.passport;
const omitExtraFields = [
  ..._.without(mongooseOmitCommonFields.underscored.keys, 'email'),
  // TODO: change to allowlist
  config.userFields.isRateLimitWhitelisted,
  config.userFields.apiToken,
  config.userFields.resetTokenExpiresAt,
  config.userFields.resetToken,
  config.userFields.changeEmailTokenExpiresAt,
  config.userFields.changeEmailToken,
  config.userFields.changeEmailNewAddress,
  config.userFields.hasSetPassword,
  config.userFields.hasVerifiedEmail,
  config.userFields.verificationPinExpiresAt,
  config.userFields.verificationPin,
  config.userFields.verificationPinSentAt,
  config.userFields.welcomeEmailSentAt,
  config.userFields.otpRecoveryKeys,
  config.userFields.pendingRecovery,
  config.userFields.isBanned,
  config.userFields.accountUpdates,
  config.userFields.twoFactorReminderSentAt,
  config.userFields.planSetAt,
  config.userFields.planExpiresAt,
  fields.otpEnabled,
  fields.otpToken,
  config.userFields.launchEmailSentAt,
  config.userFields.stripeCustomerID,
  config.userFields.stripeSubscriptionID,
  config.userFields.paypalPayerID,
  config.userFields.paypalSubscriptionID,
  config.userFields.addressHTML,
  config.userFields.hasDenylistRequests,
  config.userFields.approvedDomains,
  config.userFields.isRemoved
];

const Users = new mongoose.Schema({
  // Plan
  plan: {
    type: String,
    enum: ['free', 'enhanced_protection', 'team'],
    default: 'free',
    index: true
  },
  // Group permissions
  group: {
    type: String,
    default: 'user',
    enum: ['admin', 'user'],
    lowercase: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true,
    trim: true,
    lowercase: true,
    unique: true,
    validate: (value) => validator.isEmail(value)
  }
});

// Additional variable based properties to add to the schema
const object = {};

// Custom receipt email
object[config.userFields.receiptEmail] = {
  type: String,
  trim: true,
  lowercase: true,
  validate: (value) => !value || validator.isEmail(value)
};

// Stripe
object[config.userFields.stripeCustomerID] = {
  type: String,
  index: true
};
object[config.userFields.stripeSubscriptionID] = {
  type: String,
  index: true
};

// Paypal
object[config.userFields.paypalPayerID] = {
  type: String,
  index: true
};
object[config.userFields.paypalSubscriptionID] = {
  type: String,
  index: true
};

// Two factor auth reminders
object[config.userFields.twoFactorReminderSentAt] = Date;

// Api past due reminders
object[config.userFields.apiPastDueSentAt] = Date;
object[config.userFields.apiRestrictedSentAt] = Date;

// Payment reminders
object[config.userFields.paymentReminderInitialSentAt] = Date;
object[config.userFields.paymentReminderFollowUpSentAt] = Date;
object[config.userFields.paymentReminderFinalNoticeSentAt] = Date;
object[config.userFields.paymentReminderTerminationNoticeSentAt] = Date;

// VISA trial subscription requirement notifications
object[config.userFields.stripeTrialSentAt] = Date;
object[config.userFields.paypalTrialSentAt] = Date;

// When the user upgraded to a paid plan
object[config.userFields.planSetAt] = {
  type: Date,
  required: true,
  default() {
    return new Date(this._id.getTimestamp() || Date.now());
  }
};

// When the user's plan expires
object[config.userFields.planExpiresAt] = Date;

// User fields
object[config.userFields.isRemoved] = {
  type: Boolean,
  default: false
};

object[config.userFields.isBanned] = {
  type: Boolean,
  default: false,
  index: true
};

object[config.userFields.fullEmail] = {
  type: String,
  required: true,
  trim: true
};

object[config.userFields.defaultDomain] = {
  type: mongoose.Schema.ObjectId,
  ref: 'Domains'
};

// Rate limit whitelisting
// TODO: change to allowlist
object[config.userFields.isRateLimitWhitelisted] = {
  type: Boolean,
  default: false
};

object[config.userFields.hasDenylistRequests] = {
  type: Boolean,
  default: false
};

object[config.userFields.approvedDomains] = [
  {
    type: String,
    trim: true,
    lowercase: true,
    validate: (value) => isFQDN(value)
  }
];

// Api token for basic auth
object[config.userFields.apiToken] = {
  type: String,
  required: true,
  lowercase: true,
  trim: true,
  unique: true,
  index: true
};

object[config.userFields.otpRecoveryKeys] = Array;

// Password reset
object[config.userFields.resetTokenExpiresAt] = Date;
object[config.userFields.resetToken] = String;

// Email change
object[config.userFields.changeEmailTokenExpiresAt] = Date;
object[config.userFields.changeEmailToken] = String;
object[config.userFields.changeEmailNewAddress] = {
  type: String,
  trim: true,
  lowercase: true,
  validate: (value) => !value || validator.isEmail(value)
};

// Welcome email
object[config.userFields.welcomeEmailSentAt] = Date;

// Launch email (before 11/23/2020 10:00 AM)
object[config.userFields.launchEmailSentAt] = Date;

// Account verification
object[config.userFields.hasSetPassword] = {
  type: Boolean,
  default: false // Manually set to true during web/API signup
};
object[config.userFields.hasVerifiedEmail] = {
  type: Boolean,
  default: true, // Manually set to false during web/API signup
  index: true
};
object[config.userFields.verificationPinExpiresAt] = Date;
object[config.userFields.verificationPinSentAt] = Date;
object[config.userFields.verificationPin] = {
  type: String,
  trim: true,
  validate: (value) => isSANB(value) && value.replace(/\D/g, '').length === 6
};

object[config.userFields.pendingRecovery] = {
  type: Boolean,
  default: false
};

// List of account updates that are batched every 1 min.
object[config.userFields.accountUpdates] = Array;

// Shared field names with @ladjs/passport for consistency
object[fields.displayName] = {
  type: String,
  required: true,
  trim: true,
  maxlength: 70
};
object[fields.givenName] = {
  type: String,
  trim: true,
  maxlength: 35
};
object[fields.familyName] = {
  type: String,
  trim: true,
  maxlength: 35
};
object[fields.avatarURL] = {
  type: String,
  trim: true,
  validate: (value) => validator.isURL(value)
};
// Apple
object[fields.appleProfileID] = {
  type: String,
  index: true
};
object[fields.appleAccessToken] = String;
object[fields.appleRefreshToken] = String;
// Google
object[fields.googleProfileID] = {
  type: String,
  index: true
};
object[fields.googleAccessToken] = String;
object[fields.googleRefreshToken] = String;
// Github
object[fields.githubProfileID] = {
  type: String,
  index: true
};
object[fields.githubAccessToken] = String;
object[fields.githubRefreshToken] = String;

object[fields.otpEnabled] = {
  type: Boolean,
  default: false
};
object[fields.otpToken] = String;

// Shared field names with @ladjs/i18n and email-templates
object[config.lastLocaleField] = {
  type: String,
  default: i18n.getLocale()
};

//
// company information
//
for (const prop of [
  config.userFields.companyName,
  config.userFields.addressLine1,
  config.userFields.addressLine2,
  config.userFields.addressCity,
  config.userFields.addressState,
  config.userFields.addressZip,
  config.userFields.companyVAT
]) {
  object[prop] = {
    type: String,
    trim: true,
    maxlength: 255
  };
}

object[config.userFields.addressCountry] = {
  type: String,
  enum: ['None', ...countries],
  default: 'None'
};

// Finally add the fields
Users.add(object);

// Set plan at date to a default value
// of when user was created or >= their first payment
Users.pre('validate', async function (next) {
  // NOTE: this is a fallback in case our migration script hasn't run yet
  if (!_.isDate(this[config.userFields.planSetAt])) {
    const payment = await Payments.findOne(
      {
        user: this._id
      },
      null,
      { sort: { invoice_at: 1 } }
    );

    this[config.userFields.planSetAt] = payment
      ? new Date(payment.invoice_at)
      : new Date(this._id.getTimestamp() || Date.now());
  }

  next();
});

// Plan expires at should get updated everytime the user is saved
Users.pre('save', async function (next) {
  const user = this;
  // If user is on the free plan then return early
  if (user.plan === 'free') {
    user[config.userFields.planExpiresAt] = new Date(
      user[config.userFields.planSetAt]
    );
    return next();
  }

  try {
    //
    // the way to calculate plan expiry is to
    // take the sum of all payment durations where the payment invoice
    // is >= the user's current plan set at date
    // and then add this sum to the user's plan set at
    //
    // NOTE: we don't care about the amount, e.g. we could have refunded
    //       a customer because we had an outage, but we don't want
    //       that to effect their plan's expiration since refunds are on us
    //
    // NOTE: if a user did get a refund from changing plans,
    //       then their plan set at will change, so that takes care of that
    //
    const payments = await Payments.find({
      user: user._id,
      invoice_at: {
        $gte: new Date(user[config.userFields.planSetAt])
      },
      // Payments must match the user's current plan
      plan: user.plan
    })
      .sort('invoice_at')
      .lean()
      .exec();

    //
    // set the new expiry
    //
    // NOTE: we can't do `_.sumBy` because people pay by the month, not by the # of days in a month (e.g. 30d)
    //
    user[config.userFields.planExpiresAt] = new Date(
      user[config.userFields.planSetAt]
    );
    for (const payment of payments) {
      //
      // payments cannot be counted for credit that were
      // disputed/refunded on stripe or paypal (excluding beta and plan conversions)
      // (except for ones which we've manually adjusted or grandfathered in)
      //
      if (
        !payment.is_refund_credit_allowed &&
        payment.amount_refunded > 0 &&
        !['free_beta_program', 'plan_conversion'].includes(payment.method)
      ) {
        continue;
      }

      user[config.userFields.planExpiresAt] = dayjs(
        user[config.userFields.planExpiresAt]
      )
        .add(...config.durationMapping[payment.duration.toString()])
        .toDate();
    }

    // If the new expiry is in the future then reset the API past due sent at reminder
    // and also reset all billing reminders that have been sent
    if (
      new Date(user[config.userFields.planExpiresAt]).getTime() >= Date.now()
    ) {
      user[config.userFields.apiPastDueSentAt] = undefined;
      user[config.userFields.apiRestrictedSentAt] = undefined;
      // Only reset the reminders if it is past the reminder period
      // NOTE: if you change this then also update `jobs/billing.js`
      if (
        dayjs(user[config.userFields.planExpiresAt]).isAfter(
          dayjs().add(1, 'month')
        )
      ) {
        user[config.userFields.paymentReminderInitialSentAt] = undefined;
        user[config.userFields.paymentReminderFollowUpSentAt] = undefined;
        user[config.userFields.paymentReminderFinalNoticeSentAt] = undefined;
        user[config.userFields.paymentReminderTerminationNoticeSentAt] =
          undefined;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Sanitize input (striptags)
Users.pre('validate', function (next) {
  for (const prop of [
    fields.givenName,
    fields.familyName,
    config.userFields.companyName,
    config.userFields.addressLine1,
    config.userFields.addressLine2,
    config.userFields.addressCity,
    config.userFields.addressState,
    config.userFields.addressZip,
    config.userFields.companyVAT
  ]) {
    if (isSANB(this[prop])) {
      this[prop] = striptags(this[prop]);
    }

    if (!isSANB(this[prop])) {
      this[prop] = undefined;
    }
  }

  next();
});

//
// if the user does not have a subscription then
// unset visa trial subscription requirement notifications
//
Users.pre('save', function (next) {
  if (!isSANB(this[config.userFields.stripeSubscriptionID])) {
    this[config.userFields.stripeTrialSentAt] = undefined;
  }

  if (!isSANB(this[config.userFields.paypalSubscriptionID])) {
    this[config.userFields.paypalTrialSentAt] = undefined;
  }

  next();
});

Users.plugin(captainHook);

Users.virtual(config.userFields.addressHTML).get(function () {
  const companyName = this[config.userFields.companyName];
  const name = [
    this[config.passport.fields.givenName],
    this[config.passport.fields.familyName]
  ]
    .filter(Boolean)
    .join(' ');
  const array = [
    companyName || name ? `<strong>${companyName || name}</strong>` : null,
    this[config.userFields.addressLine1],
    this[config.userFields.addressLine2],
    [
      this[config.userFields.addressCity],
      this[config.userFields.addressState],
      this[config.userFields.addressZip]
    ]
      .filter(Boolean)
      .join(', '),
    this[config.userFields.addressCountry] &&
    this[config.userFields.addressCountry] !== 'None'
      ? this[config.userFields.addressCountry]
      : null
  ];
  return sanitizeHtml(array.filter(Boolean).join('<br />'), {
    allowedTags: ['strong', 'br'],
    allowedAttributes: []
  });
});

Users.virtual(config.userFields.verificationPinHasExpired).get(function () {
  return boolean(
    !this[config.userFields.verificationPinExpiresAt] ||
      new Date(this[config.userFields.verificationPinExpiresAt]).getTime() <
        Date.now()
  );
});

//
// TODO: this should be moved to redis or its own package under forwardemail or @ladjs
//
let disposableDomains = [];
async function crawlDisposable() {
  try {
    const { body } = await request(
      'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.json',
      {
        signal: AbortSignal.timeout(5000)
      }
    );
    const json = await body.json();
    if (!Array.isArray(json) || json.length === 0) {
      throw new Error('Disposable did not crawl data.');
    }

    disposableDomains = json;
  } catch (err) {
    logger.error(err);
  }
}

setInterval(crawlDisposable, ms('1d'));

crawlDisposable();

// This ensures that `email` was already validated, trimmed, lowercased
Users.pre('save', async function (next) {
  // Only do this for new users signing up
  // (we will most likely deprecate disposable; see jobs/check-disposable)
  if (!this.isNew) {
    return next();
  }

  const domain = this.email.split('@')[1];
  if (disposableDomains.length === 0) {
    await crawlDisposable();
  }

  // TODO: convert to Set with set.has(x) lookup vs arr.indexOf(x) !== -1
  // eslint-disable-next-line unicorn/prefer-includes
  if (disposableDomains.indexOf(domain) !== -1) {
    const error = Boom.badRequest(
      i18n.api.t({
        phrase: config.i18n.phrases.DISPOSABLE_EMAIL_NOT_ALLOWED,
        locale: this[config.lastLocaleField]
      })
    );
    error.no_translate = true;
    return next(error);
  }

  // TODO: prevent user from signing up with one of our global vanity names
  next();
});

Users.pre('validate', async function (next) {
  try {
    // Create api token if doesn't exist
    if (!isSANB(this[config.userFields.apiToken])) {
      this[config.userFields.apiToken] = await cryptoRandomString.async({
        length: 24
      });
    }

    // Set the user's display name to their email address
    // but if they have a name or surname set then use that
    this[fields.displayName] = this.email;
    if (isSANB(this[fields.givenName]) || isSANB(this[fields.familyName])) {
      this[fields.displayName] = `${this[fields.givenName] || ''} ${
        this[fields.familyName] || ''
      }`;
    }

    // Set the user's full email address (incl display name)
    this[config.userFields.fullEmail] =
      this[fields.displayName] && this[fields.displayName] !== this.email
        ? `${this[fields.displayName]} <${this.email}>`
        : this.email;

    // If otp authentication values no longer valid
    // then disable it completely
    if (
      !Array.isArray(this[config.userFields.otpRecoveryKeys]) ||
      !this[config.userFields.otpRecoveryKeys] ||
      this[config.userFields.otpRecoveryKeys].length === 0 ||
      !this[config.passport.fields.otpToken]
    ) {
      this[fields.otpEnabled] = false;
    }

    if (
      !Array.isArray(this[config.userFields.otpRecoveryKeys]) ||
      this[config.userFields.otpRecoveryKeys].length === 0
    ) {
      this[config.userFields.otpRecoveryKeys] = await Promise.all(
        Array.from({ length: 10 })
          .fill()
          .map(() => cryptoRandomString.async(options))
      );
    }

    if (!this[config.passport.fields.otpToken]) {
      this[config.passport.fields.otpToken] = authenticator.generateSecret();
    }

    next();
  } catch (err) {
    next(err);
  }
});

//
// NOTE: you should not call this method directly
// instead you should use the helper located at
// `../helpers/send-verification-email.js`
//
Users.methods.updateVerificationPin = async function (ctx, revert = false) {
  if (revert) {
    this[config.userFields.verificationPinExpiresAt] =
      this[`__${config.userFields.verificationPinExpiresAt}`];
    this[config.userFields.verificationPin] =
      this[`__${config.userFields.verificationPin}`];
    await this.save();
    return this;
  }

  // Store old values in case we have to revert
  this[`__${config.userFields.verificationPinExpiresAt}`] =
    this[config.userFields.verificationPinExpiresAt];
  this[`__${config.userFields.verificationPin}`] =
    this[config.userFields.verificationPin];

  // Set new values if necessary
  if (
    !this[config.userFields.verificationPinExpiresAt] ||
    this[config.userFields.verificationPinHasExpired] ||
    !isSANB(this[config.userFields.verificationPin])
  ) {
    this[config.userFields.verificationPinExpiresAt] = new Date(
      Date.now() + config.verificationPinTimeoutMs
    );
    this[config.userFields.verificationPin] = await cryptoRandomString.async(
      config.verificationPin
    );
  }

  const diff = this[config.userFields.verificationPinSentAt]
    ? Date.now() -
      new Date(this[config.userFields.verificationPinSentAt]).getTime()
    : false;

  const sendNewEmail =
    this[config.userFields.verificationPinHasExpired] ||
    !this[config.userFields.verificationPinSentAt] ||
    (diff && diff >= config.verificationPinEmailIntervalMs);

  // Ensure the user waited as long as necessary to send a new pin email
  if (!sendNewEmail) {
    const message = i18n.api.t(
      {
        phrase: config.i18n.phrases.EMAIL_VERIFICATION_INTERVAL,
        locale: this[config.lastLocaleField]
      },
      dayjs
        .duration(config.verificationPinEmailIntervalMs - diff, 'milliseconds')
        .locale(this[config.lastLocaleField])
        .humanize()
    );
    if (ctx) {
      const error = Boom.badRequest(message);
      error.no_translate = true;
      throw error;
    }

    const error = new Error(message);
    error.no_translate = true;
    throw error;
  }

  // Save the updated pin
  await this.save();

  return this;
};

//
// NOTE: this can come before passport-local-mongoose because
//       the username field of "email" is already marked as unique
//
Users.plugin(mongooseCommonPlugin, {
  object: 'user',
  omitCommonFields: false,
  omitExtraFields,
  defaultLocale: i18n.getLocale(),
  mongooseHidden: {
    virtuals: {
      [config.userFields.verificationPinHasExpired]: 'hide'
    }
  }
});

Users.plugin(passportLocalMongoose, config.passportLocalMongoose);

Users.post('init', (doc) => {
  for (const field of config.accountUpdateFields) {
    const fieldName = _.get(config, field);
    doc[`__${fieldName}`] = doc[fieldName];
  }
});

Users.pre('save', function (next) {
  // Filter by allowed field updates (otp enabled, profile updates, etc)
  for (const field of config.accountUpdateFields) {
    const fieldName = _.get(config, field);
    if (this[`__${fieldName}`] && this[`__${fieldName}`] !== this[fieldName]) {
      this[config.userFields.accountUpdates].push({
        fieldName,
        current: this[fieldName],
        previous: this[`__${fieldName}`]
      });
      // Revert so we don't get into infinite loop
      this[`__${fieldName}`] = this[fieldName];
    }
  }

  next();
});

Users.postCreate((user, next) => {
  logger.info('user created', {
    user: user.toObject()
  });
  next();
});

const conn = mongoose.connections.find(
  (conn) => conn[Symbol.for('connection.name')] === 'MONGO_URI'
);
if (!conn) {
  throw new Error('Mongoose connection does not exist');
}

module.exports = conn.model('Users', Users);
