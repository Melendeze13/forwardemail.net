const process = require('process');

const Boom = require('@hapi/boom');
const isSANB = require('is-string-and-not-blank');
const mongoose = require('mongoose');
const ms = require('ms');
const sharedConfig = require('@ladjs/shared-config');
const { Octokit } = require('@octokit/core');

const routes = require('../routes');
const env = require('./env');
const cookieOptions = require('./cookies');
const koaCashConfig = require('./koa-cash');
const config = require('.');
const i18n = require('#helpers/i18n');
const isErrorConstructorName = require('#helpers/is-error-constructor-name');
const logger = require('#helpers/logger');
const createTangerine = require('#helpers/create-tangerine');

const octokit = new Octokit({
  auth: env.GITHUB_OCTOKIT_TOKEN
});

let ACTIVE_GITHUB_ISSUES = {};

async function checkGitHubIssues() {
  try {
    ACTIVE_GITHUB_ISSUES = await octokit.request(
      'GET /repos/{owner}/{repo}/issues',
      {
        owner: 'forwardemail',
        repo: 'status.forwardemail.net',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    if (
      typeof ACTIVE_GITHUB_ISSUES === 'object' &&
      Array.isArray(ACTIVE_GITHUB_ISSUES.data)
    )
      ACTIVE_GITHUB_ISSUES.data = ACTIVE_GITHUB_ISSUES.data.filter(
        (obj) => obj.user.login === 'titanism'
      );
  } catch (err) {
    logger.fatal(err);
  }
}

// GitHub API is limited to 5K requests per hour
// (if we check every 10 seconds, then that is 360 requests per hour)
// (if we check every minute, then that is 60 requests per hour)
checkGitHubIssues();
setInterval(checkGitHubIssues, 60000);

const defaultSrc = isSANB(process.env.WEB_HOST)
  ? [
      "'self'",
      'data:',
      `*.${process.env.WEB_HOST}:*`,
      process.env.WEB_HOST,
      `${process.env.WEB_HOST}:*`
    ]
  : null;

const reportUri = isSANB(process.env.WEB_URL)
  ? `${process.env.WEB_URL}/report`
  : null;

const sharedWebConfig = sharedConfig('WEB');

module.exports = (redis) => ({
  ...sharedWebConfig,
  ...config,
  rateLimit: {
    ...sharedWebConfig.rateLimit,
    ...config.rateLimit
  },
  routes: routes.web,
  logger,
  i18n,
  cookies: cookieOptions,
  meta: config.meta,
  views: config.views,
  koaCash: env.CACHE_RESPONSES ? koaCashConfig(redis) : false,
  redis,
  cacheResponses: env.CACHE_RESPONSES
    ? {
        routes: [
          '/.well-known/(.*)',
          '/css/(.*)',
          '/img/(.*)',
          '/js/(.*)',
          '/fonts/(.*)',
          '/browserconfig.xml',
          '/robots.txt',
          '/site.webmanifest'
        ]
      }
    : false,
  serveStatic: {
    hidden: true
  },
  helmet: {
    // TODO: eventually make the CSP only set on PayPal required pages
    contentSecurityPolicy: defaultSrc
      ? {
          directives: {
            defaultSrc,
            connectSrc: [
              ...defaultSrc,
              'plausible.io',
              'www.paypal.com',
              'noembed.com',
              ...(env.NODE_ENV === 'production'
                ? []
                : ['www.sandbox.paypal.com'])
            ],
            fontSrc: [...defaultSrc],
            imgSrc: [
              ...defaultSrc,
              'tracking.qa.paypal.com',
              'ytimg.com',
              '*.ytimg.com'
            ],
            styleSrc: [...defaultSrc, "'unsafe-inline'"],
            scriptSrc: [
              ...defaultSrc,
              "'unsafe-inline'",
              'plausible.io',
              'challenges.cloudflare.com',
              'www.paypal.com',
              ...(env.NODE_ENV === 'production'
                ? []
                : ['www.sandbox.paypal.com'])
            ],
            frameSrc: [
              ...defaultSrc,
              'www.youtube.com',
              '*.youtube-nocookie.com',
              'challenges.cloudflare.com',
              'www.paypal.com',
              ...(env.NODE_ENV === 'production'
                ? []
                : ['www.sandbox.paypal.com'])
            ],
            reportUri: reportUri || null
          }
        }
      : null,
    // <https://hstspreload.org/>
    // <https://helmetjs.github.io/docs/hsts/#preloading-hsts-in-chrome>
    hsts: {
      // must be at least 1 year to be approved
      maxAge: ms('1y') / 1000,
      // must be enabled to be approved
      includeSubDomains: true,
      preload: true
    },
    // <https://helmetjs.github.io/docs/referrer-policy>
    // <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy>
    referrerPolicy: {
      policy: 'same-origin'
    },
    xssFilter: {
      reportUri
    }
  },
  session: {
    errorHandler(err, type, ctx) {
      if (
        // <https://github.com/luin/ioredis/issues/1716>
        err.message === 'Connection is closed.' ||
        isErrorConstructorName(err, 'MongooseError') ||
        isErrorConstructorName(err, 'MongoError') ||
        isErrorConstructorName(err, 'RedisError')
      ) {
        ctx.logger.fatal(err);
        throw Boom.clientTimeout(ctx.translateError('WEBSITE_OUTAGE'));
      }

      // unknown error
      throw err;
    }
  },
  hookBeforeSetup(app) {
    app.context.resolver = createTangerine(
      app.context.client,
      app.context.logger
    );
  },
  hookBeforePassport(app) {
    app.use(async (ctx, next) => {
      let position = 'bottom';

      // TODO: make https://status.forwardemail.net into an env var and replace it everywhere with ripgrep
      if (
        typeof ACTIVE_GITHUB_ISSUES === 'object' &&
        Array.isArray(ACTIVE_GITHUB_ISSUES.data) &&
        ACTIVE_GITHUB_ISSUES.data.length > 0
      ) {
        ctx.flash('custom', {
          title: ctx.request.t('Warning'),
          html: `<small>${ctx.translate(
            'ACTIVE_INCIDENT',
            'https://status.forwardemail.net',
            // ACTIVE_GITHUB_ISSUES.data.length > 1
            //   ? 'https://status.forwardemail.net'
            //   : ACTIVE_GITHUB_ISSUES.data[0].html_url ||
            //       'https://status.forwardemail.net',
            ACTIVE_GITHUB_ISSUES.data[0].title ||
              'Please view our status page for more information.'
          )}</small>`,
          type: 'warning',
          toast: true,
          showConfirmButton: false,
          position,
          timer: 5000
        });
        position = 'top';
      }

      // if either mongoose or redis are not connected
      // then render website outage message to users
      const isMongooseDown = mongoose.connections.some(
        (conn) => conn.readyState !== mongoose.ConnectionStates.connected
      );
      const isRedisDown =
        !ctx.client || (ctx.client.status && ctx.client.status !== 'ready');

      if (isMongooseDown || isRedisDown) {
        const obj = {};
        obj.mongoose = mongoose.connections.map((conn) => ({
          id: conn.id,
          readyState: conn.readyState,
          name: conn.name,
          host: conn.host,
          port: conn.port
        }));
        if (ctx?.client?.status && ctx?.client?._getDescription)
          obj.redis = {
            status: ctx.client.status,
            description: ctx.client._getDescription()
          };
        else obj.redis = 'ioredis-mock';
        ctx.logger.fatal(new Error('Website outage'), obj);
      }

      if (
        ctx.method === 'GET' &&
        ctx.accepts('html') &&
        (isMongooseDown || isRedisDown)
      ) {
        ctx.flash('custom', {
          title: ctx.request.t('Warning'),
          html: `<small>${ctx.translate('WEBSITE_OUTAGE')}</small>`,
          type: 'warning',
          toast: true,
          showConfirmButton: false,
          timer: 5000,
          position
        });
      }

      return next();
    });
  }
});
