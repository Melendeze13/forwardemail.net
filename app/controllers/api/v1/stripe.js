const Boom = require('@hapi/boom');
const Stripe = require('stripe');
const dayjs = require('dayjs-with-plugins');
const delay = require('delay');
const isSANB = require('is-string-and-not-blank');
const ms = require('ms');
const parseErr = require('parse-err');
const _ = require('lodash');

const { Users } = require('#models');
const config = require('#config');
const env = require('#config/env');
const syncStripePaymentIntent = require('#helpers/sync-stripe-payment-intent');
const emailHelper = require('#helpers/email');

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const { STRIPE_PRODUCTS } = config.payments;

// <https://stripe.com/docs/webhooks/signatures>
// eslint-disable-next-line complexity
async function webhook(ctx) {
  let event;
  try {
    const sig = ctx.request.get('stripe-signature');

    // throw an error if something was wrong
    if (!isSANB(sig))
      throw Boom.badRequest(ctx.translateError('INVALID_STRIPE_SIGNATURE'));

    event = stripe.webhooks.constructEvent(
      ctx.request.rawBody,
      sig,
      env.STRIPE_ENDPOINT_SECRET
    );

    // throw an error if something was wrong
    if (!event)
      throw Boom.badRequest(ctx.translateError('INVALID_STRIPE_SIGNATURE'));

    ctx.logger.info('stripe webhook', { event });

    // return a response to acknowledge receipt of the event
    ctx.body = { received: true };
  } catch (err) {
    ctx.throw(err);
    return;
  }

  try {
    //
    // handle the events
    // <https://stripe.com/docs/cli/trigger#trigger-event>
    //
    switch (event.type) {
      // create or update existing payment
      // (we may also want to upgrade plan; e.g. in case redirect does not occur)
      // (also need to ensure no conflicts with redirect)
      case 'charge.captured':
      case 'charge.succeeded':
      case 'charge.refunded': {
        if (event.data.object.object !== 'charge')
          throw new Error('Event object was not a charge');

        const charge = event.data.object;
        // ensure it has customer
        if (!isSANB(charge.customer))
          throw new Error('Charge did not have customer');

        // ensure it has payment_intent
        if (!isSANB(charge.payment_intent))
          throw new Error('Charge did not have payment_intent');

        // lookup user in our system
        const user = await Users.findOne({
          [config.userFields.stripeCustomerID]: charge.customer
        });

        if (!user) throw new Error('User did not exist for customer');

        //
        // NOTE: this re-uses the payment intent mapper that is also used
        //       in the job for `sync-stripe-payments` which syncs payments
        //
        const paymentIntent = await stripe.paymentIntents.retrieve(
          charge.payment_intent
        );
        if (!paymentIntent)
          throw new Error('Payment intent did not exist in Stripe');
        const errorEmails = await syncStripePaymentIntent(user)(
          [],
          paymentIntent
        );
        if (errorEmails.length > 0) {
          try {
            await Promise.all(errorEmails.map((email) => emailHelper(email)));
          } catch (err) {
            ctx.logger.error(err);
          }
        }

        break;
      }

      case 'checkout.session.async_payment_failed': {
        if (event.data.object.object !== 'checkout.session')
          throw new Error('Event object was not a checkout.session');
        const session = event.data.object;
        // lookup user by customer
        const user = await Users.findOne({
          [config.userFields.stripeCustomerID]: session.customer
        });
        if (!user) throw new Error('User did not exist for customer');
        // email the user and CC admins
        await emailHelper({
          template: 'alert',
          message: {
            to:
              user[config.userFields.receiptEmail] ||
              user[config.userFields.fullEmail],
            ...(user[config.userFields.receiptEmail]
              ? {
                  cc: [
                    user[config.userFields.fullEmail],
                    config.email.message.from
                  ]
                }
              : { cc: config.email.message.from }),
            subject: 'Issue with delayed payment'
          },
          locals: {
            message: `
            <p>There was an issue with your payment and you were not charged.</p>
            <p>Please go to your billing page to try again with a new payment method.</p>
            <p><a href="/my-account/billing" class="btn btn-dark btn-lg" rel="noopener noreferrer" target="_blank">Manage Billing</a></p>
            `
          }
        });
        break;
      }

      // TODO: we also need to do something similar for paypal

      // then lookup the session if it existed for the payment intent
      // and lookup the plan mapping, and if it doesn't match then adjust it
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.completed': {
        // most of this logic is mirrored from web/my-account/retrieve-domain-billing.js
        if (event.data.object.object !== 'checkout.session')
          throw new Error('Event object was not a checkout.session');
        const session = event.data.object;
        if (session.payment_status !== 'paid')
          throw new Error('Session was not paid');
        // lookup user by customer
        const user = await Users.findOne({
          [config.userFields.stripeCustomerID]: session.customer
        });
        if (!user) throw new Error('User did not exist for customer');

        // look at the line items
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id
        );

        if (!Array.isArray(lineItems.data) || lineItems.data.length !== 1)
          throw ctx.translateError('UNKNOWN_ERROR');

        // look up the product associated with the line item
        // (it should match ctx.query.plan but this is a safeguard)
        const productToPlan = STRIPE_PRODUCTS[lineItems.data[0].price.product];

        if (
          !isSANB(productToPlan) ||
          !['team', 'enhanced_protection'].includes(productToPlan)
        )
          throw new Error('Plan was not valid');

        //
        // NOTE: this re-uses the payment intent mapper that is also used
        //       in the job for `sync-stripe-payments` which syncs payments
        //
        if (session.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            session.payment_intent
          );
          if (!paymentIntent)
            throw new Error('Payment intent did not exist in Stripe');

          // sync the payment intent
          const errorEmails = await syncStripePaymentIntent(user)(
            [],
            paymentIntent
          );
          if (errorEmails.length > 0) {
            // eslint-disable-next-line max-depth
            try {
              await Promise.all(errorEmails.map((email) => emailHelper(email)));
            } catch (err) {
              ctx.logger.error(err);
            }
          }

          // lookup the payment intent created date and if its after plan_set_at then adjust it
          if (
            !_.isDate(user[config.userFields.planSetAt]) ||
            new Date(user[config.userFields.planSetAt]).getTime() <
              dayjs.unix(paymentIntent.created).toDate().getTime()
          )
            user[config.userFields.planSetAt] = dayjs
              .unix(paymentIntent.created)
              .toDate();
        } else if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );
          if (!subscription)
            throw new Error('Subscription does not exist in Stripe');
          // store the subscription id to the user
          user[config.userFields.stripeSubscriptionID] = subscription.id;
          // if it was not a trial then lookup the payment intent
          if (subscription.status !== 'trialing') {
            const invoices = await stripe.invoices.list({
              limit: 100, // it'd be impossible for a customer to hit this (at least right now)
              customer: session.customer,
              subscription: subscription.id
            });
            // eslint-disable-next-line max-depth
            if (invoices.has_more)
              throw new Error('Invoices object should not have more');
            invoices.data = _.sortBy(invoices.data, 'created');
            // eslint-disable-next-line max-depth
            if (
              invoices.data.length === 0 ||
              !invoices.data[0] ||
              !invoices.data[0].id ||
              !invoices.data[0].payment_intent
            )
              throw new Error('Payment intent missing');
            const paymentIntent = await stripe.paymentIntents.retrieve(
              invoices.data[0].payment_intent
            );
            // eslint-disable-next-line max-depth
            if (!paymentIntent)
              throw new Error('Payment intent did not exist in Stripe');
            // sync the payment intent
            const errorEmails = await syncStripePaymentIntent(user)(
              [],
              paymentIntent
            );
            // eslint-disable-next-line max-depth
            if (errorEmails.length > 0) {
              // eslint-disable-next-line max-depth
              try {
                await Promise.all(
                  errorEmails.map((email) => emailHelper(email))
                );
              } catch (err) {
                ctx.logger.error(err);
              }
            }

            // lookup the payment intent created date and if its after plan_set_at then adjust it
            // eslint-disable-next-line max-depth
            if (
              !_.isDate(user[config.userFields.planSetAt]) ||
              new Date(user[config.userFields.planSetAt]).getTime() <
                dayjs.unix(paymentIntent.created).toDate().getTime()
            )
              user[config.userFields.planSetAt] = dayjs
                .unix(paymentIntent.created)
                .toDate();
          }
        }

        // if the plans don't match up them sync them
        if (user.plan !== productToPlan) user.plan = productToPlan;

        // finally save the user
        await user.save();
        break;
      }

      // TODO: 'payment_intent.succeeded'

      // ban users that dispute charges
      // and cancel their subscriptions (if not already)
      case 'charge.dispute.created': {
        // event.data.object is a dispute object
        if (event.data.object.object !== 'dispute')
          throw new Error('Event object was not a dispute');
        const dispute = event.data.object;
        // close the dispute (accepts as lost)
        await stripe.disputes.close(dispute.id);
        // ensure it has payment_intent
        if (!isSANB(dispute.payment_intent))
          throw new Error('Dispute did not have payment_intent');
        // attempt to sync the payment (so user gets a refund email)
        const paymentIntent = await stripe.paymentIntents.retrieve(
          dispute.payment_intent
        );
        if (!paymentIntent)
          throw new Error('Payment intent did not exist in Stripe');
        // lookup the user from the payment intent customer field
        if (!isSANB(paymentIntent.customer))
          throw new Error('Payment intent missing customer field');
        const user = await Users.findOne({
          [config.userFields.stripeCustomerID]: paymentIntent.customer
        });
        if (!user) throw new Error('User did not exist for customer');
        // artificially wait 5s for refund to process
        await delay(ms('5s'));
        //
        // NOTE: this re-uses the payment intent mapper that is also used
        //       in the job for `sync-stripe-payments` which syncs payments
        //
        const errorEmails = await syncStripePaymentIntent(user)(
          [],
          paymentIntent
        );
        if (errorEmails.length > 0) {
          try {
            await Promise.all(errorEmails.map((email) => emailHelper(email)));
          } catch (err) {
            ctx.logger.error(err);
          }
        }

        // cancel the user's subscription
        if (isSANB(user[config.userFields.stripeSubscriptionID])) {
          try {
            await stripe.subscriptions.del(
              user[config.userFields.stripeSubscriptionID]
            );
          } catch (err) {
            ctx.logger.error(err);
          }

          user[config.userFields.stripeSubscriptionID] = undefined;
          await user.save();
        }

        // ban the user for opening a dispute
        if (!user.is_banned) {
          user.is_banned = true;
          await user.save();
          // email admins that the user was banned
          await emailHelper({
            template: 'alert',
            message: {
              to: config.email.message.from,
              subject: `Customer banned for opening Stripe dispute: ${user.email}`
            },
            locals: {
              message: `Customer with email ${user.email} was banned for opening dispute ID ${dispute.id}.`
            }
          });
        }

        break;
      }

      // set subscription for customer if not already set
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // event.data.object is a subscription object
        if (event.data.object.object !== 'subscription')
          throw new Error('Event object was not a subscription');
        const subscription = event.data.object;
        if (['active', 'trialing'].includes(subscription.status))
          await Users.findOneAndUpdate(
            {
              [config.userFields.stripeCustomerID]: subscription.customer
            },
            {
              $set: {
                [config.userFields.stripeSubscriptionID]: subscription.id
              }
            }
          );
        break;
      }

      // remove stripe subscription from user
      // when cancelled (if not already)
      case 'customer.subscription.deleted': {
        // event.data.object is a subscription object
        if (event.data.object.object !== 'subscription')
          throw new Error('Event object was not a subscription');
        const subscription = event.data.object;
        await Users.findOneAndUpdate(
          {
            [config.userFields.stripeSubscriptionID]: subscription.id
          },
          {
            $unset: {
              [config.userFields.stripeSubscriptionID]: 1
            }
          }
        );
        break;
      }

      // TODO: handle other events
      default:
    }
  } catch (err) {
    ctx.logger.fatal(err, { event });
    // email admin errors
    await emailHelper({
      template: 'alert',
      message: {
        to: config.email.message.from,
        subject: `Error with Stripe Webhook${
          event && event.id ? ` (Event ID ${event.id})` : ''
        }`
      },
      locals: {
        message: `<pre><code>${JSON.stringify(
          parseErr(err),
          null,
          2
        )}</code></pre>`
      }
    });
  }
}

module.exports = webhook;
