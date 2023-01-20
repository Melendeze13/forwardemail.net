const Boom = require('@hapi/boom');
const _ = require('lodash');
const isFQDN = require('is-fqdn');
const isSANB = require('is-string-and-not-blank');
const splitLines = require('split-lines');
const { boolean } = require('boolean');
const { fromUrl, parseDomain, ParseResultType } = require('parse-domain');
const { isIP } = require('validator');

const config = require('#config');

// eslint-disable-next-line complexity
async function validateDomain(ctx, next) {
  if (
    !isSANB(ctx.request.body.domain) ||
    (!isFQDN(ctx.request.body.domain) && !isIP(ctx.request.body.domain))
  )
    return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DOMAIN')));

  // trim and convert to lowercase the domain name
  ctx.request.body.domain = ctx.request.body.domain.trim().toLowerCase();

  const match = ctx.state.domains.find(
    (domain) => domain.name === ctx.request.body.domain
  );

  if (match) {
    if (ctx.api)
      return ctx.throw(
        Boom.badRequest(ctx.translateError('DOMAIN_ALREADY_EXISTS'))
      );

    const message = ctx.translate('DOMAIN_ALREADY_EXISTS');
    ctx.flash('warning', message);

    const redirectTo = ctx.state.l(`/my-account/domains/${match.name}/aliases`);

    if (ctx.accepts('html')) {
      ctx.redirect(redirectTo);
    } else {
      ctx.body = { redirectTo };
    }

    return;
  }

  //
  // check if domain is on the allowlist or denylist
  //
  const parseResult = parseDomain(fromUrl(ctx.request.body.domain));
  const rootDomain = (
    parseResult.type === ParseResultType.Listed &&
    _.isObject(parseResult.icann) &&
    isSANB(parseResult.icann.domain)
      ? `${parseResult.icann.domain}.${parseResult.icann.topLevelDomains.join(
          '.'
        )}`
      : ctx.request.body.domain
  ).toLowerCase();

  let isAllowlist = false;
  let isDenylist = false;
  try {
    [isAllowlist, isDenylist] = await Promise.all([
      ctx.client.get(`allowlist:${rootDomain}`),
      ctx.client.get(`denylist:${rootDomain}`)
    ]);
    isAllowlist = boolean(isAllowlist);
    isDenylist = boolean(isDenylist);
  } catch (err) {
    ctx.logger.fatal(err);
  }

  // if it was allowlisted then notify them to contact help
  // (we would manually create)
  if (
    isAllowlist &&
    !ctx.state.user[config.userFields.approvedDomains].includes(rootDomain)
  ) {
    ctx.logger.fatal(
      new Error(
        `Account approval required for: ${ctx.request.body.domain} (${rootDomain})`
      )
    );
    return ctx.throw(
      Boom.badRequest(
        ctx.translateError(
          'ALLOWLIST_DOMAIN_NOT_ALLOWED',
          rootDomain,
          ctx.state.l('/help')
        )
      )
    );
  }

  if (isDenylist)
    return ctx.throw(
      Boom.badRequest(
        ctx.translateError(
          'DENYLIST_DOMAIN_NOT_ALLOWED',
          rootDomain,
          ctx.state.l(`/denylist?q=${rootDomain}`)
        )
      )
    );

  if (isSANB(ctx.request.body.plan)) {
    if (
      !['free', 'enhanced_protection', 'team'].includes(ctx.request.body.plan)
    )
      return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_PLAN')));
  } else {
    ctx.request.body.plan = ctx.state.user.plan || 'free';
  }

  // check if we're creating a default catchall
  ctx.state.recipients = [ctx.state.user.email];

  if (_.isBoolean(ctx.request.body.catchall) && !ctx.request.body.catchall)
    ctx.state.recipients.pop();
  else if (isSANB(ctx.request.body.catchall)) {
    const rcpts = _.compact(
      _.uniq(
        _.map(
          splitLines(ctx.request.body.catchall)
            .join(' ')
            .split(',')
            .join(' ')
            .split(' '),
          (recipient) => recipient.trim()
        )
      )
    );
    for (const rcpt of rcpts) {
      ctx.state.recipients.push(rcpt);
    }
  }

  ctx.state.redirectTo = ctx.state.l(
    `/my-account/domains/${ctx.request.body.domain}`
  );

  // if the user was not on a valid plan then redirect them to billing post creation
  if (isSANB(ctx.request.body.plan)) {
    switch (ctx.request.body.plan) {
      case 'enhanced_protection': {
        if (!['enhanced_protection', 'team'].includes(ctx.state.user.plan)) {
          ctx.request.body.plan = 'free';
          ctx.state.redirectTo = ctx.state.l(
            `/my-account/domains/${ctx.request.body.domain}/billing?plan=enhanced_protection`
          );
        }

        break;
      }

      case 'team': {
        if (ctx.state.user.plan !== 'team') {
          ctx.request.body.plan =
            ctx.state.user.plan === 'enhanced_protection'
              ? 'enhanced_protection'
              : 'free';
          ctx.state.redirectTo = ctx.state.l(
            `/my-account/domains/${ctx.request.body.domain}/billing?plan=team`
          );
        }

        break;
      }

      // No default
    }
  }

  // Boolean settings for spam and requiring recipient verification
  ctx.state.optionalBooleans = {};
  for (const bool of [
    'has_adult_content_protection',
    'has_phishing_protection',
    'has_executable_protection',
    'has_virus_protection',
    'has_recipient_verification'
  ]) {
    if (_.isBoolean(ctx.request.body[bool]) || isSANB(ctx.request.body[bool]))
      ctx.state.optionalBooleans[bool] = boolean(ctx.request.body[bool]);
  }

  return next();
}

module.exports = validateDomain;
