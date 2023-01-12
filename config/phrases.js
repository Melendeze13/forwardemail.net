const statuses = require('statuses');

const env = require('./env');

// turn off max length eslint rule since this is a config file with long strs
/* eslint max-len: 0 */

//
// NOTE: page title's use this if status code is not 200
// (e.g we don't want to render koa-meta titles on 404's)
//
const STATUSES = {};
for (const key of Object.keys(statuses.message)) {
  STATUSES[key.toString()] = statuses.message[key];
}

module.exports = {
  SEARCH_PAGE: 'Search page',
  TABLE_OF_CONTENTS: 'Table of Contents',
  PAYPAL_NOT_LOADED: 'Please wait for PayPal to load and try again.',
  BACKSCATTER:
    'The IP <span class="notranslate">%s</span> is denylisted by <a href="https://www.backscatterer.org" target="_blank" rel="noopener noreferrer">https://www.backscatterer.org</a>. To request removal, you must visit <a href="https://www.backscatterer.org/index.php?target=test&ip=%s" target="_blank" rel="noopener noreferrer">https://www.backscatterer.org/index.php?target=test&ip=%s</a>.',
  INSTANT_DENYLIST_AVAILABLE:
    'You may now submit your denylist removal request for instant removal.',
  DENYLIST_REMOVAL_SUCCESS:
    '<span class="notranslate">%s</span> was successfully removed from our denylist.',
  HELLO: 'Hello',
  WWW_WARNING:
    'It looks like you accidentally included "www." in your domain name.  Did you mean example.com instead of www.example.com?',
  INVALID_PROFILE_RESPONSE:
    'Invalid profile response, please delete this site from your third-party sign-in preferences and try again.',
  INVALID_PROFILE_ID:
    'Invalid profile identifier, please delete this site from your third-party sign-in preferences and try again.',
  CONSENT_REQUIRED:
    'Offline access consent required to generate a new refresh token.',
  OTP_NOT_ENABLED: 'OTP authentication is not enabled.',
  OTP_TOKEN_DOES_NOT_EXIST: 'OTP token does not exist for validation.',
  INVALID_API_CREDENTIALS: 'Invalid API credentials.',
  INVALID_API_TOKEN: 'Invalid API token.',
  INVALID_EMAIL: 'Email address was invalid.',
  INVALID_FILE: 'File upload was invalid.',
  INVALID_DENYLIST_VALUE:
    'Invalid domain name, IP address, email address. Please correct your denylist removal request and try again.',
  INVALID_DENYLIST_REQUEST: 'Value was not currently found in our denylist.',
  INVALID_KEY_VALUE:
    'Value was invalid, must be FQDN, EMAIL, IP, FQDN:email, or IP:email.',
  INVALID_MESSAGE: `Your message was invalid, as it was either blank or more than (${env.SUPPORT_REQUEST_MAX_LENGTH}) characters.`,
  INVALID_PASSWORD: 'Password was invalid.',
  INVALID_PASSWORD_CONFIRM: 'Password confirmation did not match new password.',
  INVALID_PASSWORD_STRENGTH: 'Password strength was not strong enough.',
  INVALID_PORT: 'Invalid port number.',
  INVALID_PROVIDER: 'We do not support this authentication provider.',
  INVALID_RECOVERY_KEY: 'Invalid recovery key.',
  INVALID_RESET_PASSWORD: 'Reset token and email were not valid together.',
  INVALID_SET_EMAIL: 'Change email token and email were not valid together.',
  INVALID_RESET_TOKEN: 'Reset token provided was invalid.',
  INVALID_SESSION_SECRET: 'Invalid session secret.',
  INVALID_SLUG: 'Please slightly change values to ensure slug uniqueness.',
  INVALID_STRING: '<span class="notranslate">%s</span> was missing or blank.',
  INVALID_USER: 'User does not exist.',
  INVALID_MEMBER: 'Member does not exist.',
  INVALID_VERIFICATION_PIN: 'The verification code entered was invalid.',
  INVALID_PAYMENT_METHOD:
    'Payment method must be either card, wallet, bank, or PayPal.',
  INVALID_PAYMENT_TYPE: 'Payment type must be either one-time or subscription.',
  INVALID_PAYMENT_DURATION: 'Payment duration was invalid.',
  JAVASCRIPT_REQUIRED: 'Please enable JavaScript to continue.',
  EMAIL_VERIFICATION_REQUIRED: 'Please verify your email address to continue.',
  EMAIL_VERIFICATION_INTERVAL:
    'Please wait for <span class="notranslate">%s</span> and try again.',
  EMAIL_VERIFICATION_SUCCESS:
    'Your email address has been successfully verified.',
  EMAIL_ALREADY_VERIFIED: 'Your email address is already verified.',
  EMAIL_VERIFICATION_SENT:
    'A verification code has been sent to your email address.',
  EMAIL_VERIFICATION_EXPIRED:
    'Your current email verification code has expired and we have sent a new one to your email address.',
  INVALID_OTP_PASSCODE: 'Invalid two-factor authentication passcode.',
  IS_NOT_ADMIN: 'You do not belong to the administrative user group.',
  TWO_FACTOR_REQUIRED:
    'Please log in with two-factor authentication to continue.',
  LOGIN_REQUIRED: 'Please log in or sign up to view the page you requested.',
  LOGIN_REQUIRED_FOR_ACTION:
    'We tried to create a new account with this email address, but it already exists.  Please log in with this email address if it belongs to you and then try again.',
  LOGOUT_REQUIRED: 'Please log out to view the page you requested.',
  ALIAS_DOES_NOT_EXIST: 'Alias does not exist on the domain.',
  NO_DOMAINS_EXIST: 'Add a domain name to your account to continue.',
  NO_ALIASES_EXIST: 'Add a new alias to continue.',
  INVALID_DOMAIN:
    'Domain name was invalid (must be a domain name without protocol, for example "domain.com" instead of "http://domain.com" or an IP address).',
  INVALID_FQDN:
    'Domain name was invalid (must be a domain name without protocol, for example "domain.com" instead of "http://domain.com").',
  ADD_ALIAS: 'Add Alias',
  CATCHALL_ADMIN_REQUIRED:
    'User must be a domain admin to create a catch-all alias.',
  ALIAS_ALREADY_EXISTS: 'Alias already exists for domain.',
  DOMAIN_IS_VERIFIED: "Domain's DNS records have been verified.",
  DOMAIN_DOES_NOT_EXIST: 'Domain does not exist on your account.',
  RESERVED_WORD_ADMIN_REQUIRED:
    'User must be a domain admin to create an alias with a reserved word (see the page on <a target="_blank" rel="noopener noreferrer" class="font-weight-bold" href="%s/reserved-email-addresses">Reserved Email Addresses</a>).',
  REACHED_MAX_ALIAS_COUNT:
    'User cannot have more than (5) aliases on global domains.',
  EXCEEDED_UNIQUE_COUNT:
    'You have exceeded the maximum count of (<span class="notranslate">%s</span>) recipients per alias.  Please <a class="font-weight-bold" href="/help">contact us</a> if you wish to have this limit increased.  We review requests on a unique basis.  Please provide us with information about your forwarding purposes if possible.',
  DOMAIN_DOES_NOT_EXIST_ANYWHERE: 'Domain does not exist.',
  INVITE_DOES_NOT_EXIST:
    'Invite does not exist with your email address for this domain.',
  DOMAIN_ALREADY_EXISTS: 'Domain already exists on your account.',
  ACCOUNT_DELETE_HAS_DOMAINS:
    'Your account is currently an admin of one or more domain names.  Please delete these domains or remove yourself from them to continue.',
  ACCOUNT_DELETE_SUCCESSFUL: 'Your account was successfully deleted.',
  PASSWORD_RESET_LIMIT: 'Please try again <span class="notranslate">%s</span>.',
  PASSWORD_RESET_SENT: 'We have emailed you a link to reset your password.',
  PASSWORD_CONFIRM_SUCCESS: 'Password successfully confirmed.',
  PASSWORD_REQUIRED: 'Please set a password on your account to continue.',
  EMPTY_RECOVERY_KEYS: 'Empty Recovery Keys',
  OTP_RECOVERY_RESET:
    'You have run out of recovery keys. Please download the newly generated recovery keys before continuing.',
  OTP_RECOVERY_SUCCESS:
    'Recovery key successful. This key will no longer be valid.',
  REGISTERED: 'You have successfully registered.',
  SIGNED_IN: 'You have successfully signed in.',
  ALREADY_SIGNED_IN: 'You are already signed in.',
  REQUEST_OK: 'Your request was successfully completed.',
  REQUEST_TIMED_OUT:
    'Sorry, your request has timed out.  We have been alerted of this issue.  Please try again.',
  RESET_PASSWORD: 'You have successfully set a new password.',
  CHANGE_EMAIL: 'You have successfully set a new email address.',
  SIGNED_OUT: 'You have successfully signed out.',
  PENDING_RECOVERY_VERIFICATION_SUCCESS:
    'Your email has been successfully verified. You should receive a support email from an admin within the next 3-5 business days.',
  SUPPORT_REQUEST_ERROR:
    'We were unable to send your help request.  We have been alerted of this problem.  Please try again or directly email <a href="mailto:support@forwardemail.net">support@forwardemail.net</a>.',
  SUPPORT_REQUEST_LIMIT:
    'You have reached the limit for sending help requests.  Please try again.',
  SUPPORT_REQUEST_MESSAGE:
    'Thank you for contacting us.  We would love to hear more from you.  How can we help?',
  SUPPORT_REQUEST_SENT:
    'Your help request has been sent successfully.  You should hear from us soon.  Thank you!',
  UNKNOWN_ERROR:
    'An unknown error has occurred. We have been alerted of this issue. Please try again.',
  PASSPORT_MISSING_PASSWORD_ERROR: 'Please enter a password.',
  PASSPORT_ATTEMPT_TOO_SOON_ERROR:
    'Account is currently locked due to rate limiting.  Please try again later.',
  PASSPORT_TOO_MANY_ATTEMPTS_ERROR:
    'Account is currently locked due to too many failed login attempts.  Please try again later.',
  PASSPORT_NO_SALT_VALUE_STORED_ERROR:
    'Please log in with Google or GitHub and set your password in order to be able to log in with your email address.',
  PASSPORT_INCORRECT_PASSWORD_ERROR: 'Email address or password is incorrect.',
  PASSPORT_INCORRECT_USERNAME_ERROR: 'Email address or password is incorrect.',
  PASSPORT_MISSING_USERNAME_ERROR: 'Please enter an email address.',
  PASSPORT_USER_EXISTS_ERROR:
    'A user with the given email address is already registered.  Please try to log in or reset the password if this account belongs to you.',
  PLAN_ALREADY_ACTIVE: 'This plan is already active, please refresh.',
  UPGRADE_PLAN: 'Upgrade Plan',
  INVALID_PLAN: 'Invalid plan selected.',
  PLAN_UPGRADE_REQUIRED:
    'Please <a class="font-weight-bold" href="%s">upgrade to a paid plan</a> to unlock this feature.',
  PLAN_UPGRADE_REQUIRED_FOR_GLOBAL_DOMAINS:
    'Please <a class="font-weight-bold" target="_blank" href="%s">upgrade to the Enhanced Protection Plan</a> to unlock vanity domains on your account.',
  INVITE_ACCEPTED_ADMIN:
    'You have successfully accepted the invite to this domain and are an admin.',
  INVITE_ACCEPTED_USER:
    'You have successfully accepted the invite to this domain and you can now create your first alias.',
  INVITE_EMAIL_ERROR:
    'An error occurred while emailing the invite link.  Please manually copy the the invite link and share it with this person if needed.',
  INVALID_GROUP: 'Group was invalid, must be either admin or user.',
  INVITE_ALREADY_SENT:
    'Invite was already sent to this email address.  Please manually copy the invite link and share it with this person if needed.',
  FREE: 'Free',
  ENHANCED_PROTECTION: 'Enhanced Protection',
  TEAM: 'Team',
  FREE_PLAN: 'You have successfully downgraded to the Free Plan.',
  ENHANCED_PROTECTION_PLAN:
    'You have successfully upgraded to the Enhanced Protection Plan.',
  TEAM_PLAN: 'You have successfully upgraded to the Team Plan.',
  AUTO_RENEW_STARTS:
    'Auto-renew successfully enabled (starts on <span class="notranslate">%s</span>)',
  AUTO_RENEW_ENABLED:
    'You have successfully subscribed and enabled auto-renew.',
  ACCOUNT_BANNED: 'Your account has been banned.',
  ENOTFOUND:
    'Domain is not a registered domain name. <a class="font-weight-bold" href="/domain-registration">Click here to register it now</a>.',
  MISSING_DNS_TXT:
    'Domain is missing required DNS <span class="notranslate">TXT</span> records. <a class="font-weight-bold" href="/faq?domain=%s" target="_blank">Read our FAQ</a> for detailed instructions.',
  MISSING_DNS_NS: 'Domain does not have DNS nameservers configured.',
  SINGLE_VERIFICATION_RECORD_REQUIRED:
    'Domain has multiple verification records.  Please ensure there is only one verification record that exists.',
  MULTIPLE_PORT_RECORDS:
    'Domain has multiple port records.  Please ensure there is only one port record that exists.',
  AT_LEAST_ONE_ADMIN_REQUIRED:
    'At least one admin user must belong to the domain.',
  INVALID_VERIFICATION_RECORD:
    'Verification record must only use characters A-Z and numbers 0-9.',
  MX_HAS_OTHER:
    '<p class="mb-0">We have detected that your domain has multiple MX server providers. Please ensure that the <strong>ONLY</strong> DNS MX records are:</p><ul class="markdown-body ml-0 mr-0 mb-3"><span class="notranslate">%s</span></ul><p class="mb-0">Please ensure you do not have any typos and have both unique records added (e.g. make sure both records aren\'t the same). <a class="font-weight-bold" href="/faq?domain=%s" target="_blank">Read our FAQ</a> for detailed instructions.</p>',
  MISSING_DNS_MX:
    '<p class="mb-0">Domain is missing required DNS MX records of:</p><ul class="markdown-body ml-0 mr-0 mb-3"><span class="notranslate">%s</span></ul><p class="mb-0">Please ensure you do not have any typos and have both unique records added (e.g. make sure both records aren\'t the same). <a class="font-weight-bold" href="/faq?domain=%s" target="_blank">Read our FAQ</a> for detailed instructions.</p>',
  DNS_CHANGES_TAKE_TIME:
    '<p class="mb-0"><strong>Making changes to your DNS records takes time to propagate throughout the Internet. <span class="text-danger">You may need to wait a few minutes</span> and then try again.</strong></p>',
  MISSING_VERIFICATION_RECORD:
    'Domain is missing required DNS <span class="notranslate">TXT</span> record of: <span class="notranslate">%s</span>',
  INCORRECT_VERIFICATION_RECORD:
    'Domain has an incorrect DNS <span class="notranslate">TXT</span> record for verification.  Please ensure <span class="notranslate">%s</span> is the only verification record that exists.',
  MULTIPLE_VERIFICATION_RECORDS:
    'Domain has multiple verification records.  Please ensure <span class="notranslate">%s</span> is the only verification record that exists.',
  NAMESERVER_CHECK:
    'Please ensure that your DNS nameservers are set properly too (e.g. if you are using a DNS provider such as Cloudflare &ndash; which may be a different provider than your domain registrar).',
  AUTOMATED_CHECK:
    'If we detect your DNS records are valid, then we will send you an automated email alert.  We routinely check DNS records for your domain every few hours.',
  IMPORT_ALIAS_ALREADY_EXISTS:
    'Could not import "<span class="notranslate">%s</span>" record\'s recipient of "<span class="notranslate">%s</span>" since it already exists as an alias.',
  IMPORT_ALIAS_DISABLED_NOBODY:
    'We successfully imported the disabled address of "<span class="notranslate">%s</span>", but we had to do so with a single recipient of "nobody@forwardemail.net" because it did not have a recipient in the imported DNS entry.',
  IMPORT_CATCHALL_ALREADY_INCLUDES:
    'Could not import catch-all record\'s recipient of "<span class="notranslate">%s</span>" since the catch-all already includes it as a recipient.',
  IMPORT_SUCCESSFUL:
    'Successfully imported (<span class="notranslate">%d</span>) aliases.',
  IMPORT_ERROR: 'An error occurred while importing aliases.',
  IMPORT_NO_ALIASES_AVAILABLE: 'No aliases were available to import.',
  IMPORT_CATCHALL_SUCCESSFUL:
    'Successfully imported (<span class="notranslate">%d</span>) catch-all recipients.',
  IMPORT_CATCHALL_ERROR:
    'An error occurred while importing catch-all recipients.',
  IMPORT_CATCHALL_NONE: 'No catch-all recipients were available to import.',
  MULTIPLE_VERIFICATION_ERRORS:
    'Multiple errors occurred during record verification.',
  USER_ALREADY_MEMBER: 'User is already an accepted member of this domain',
  METRICS_NOT_AVAILABLE:
    'Our metrics are not available, please check back later.',
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  WEEK: 'Week',
  USERS: 'Users',
  DOMAINS: 'Domains',
  ALIASES: 'Aliases',
  PAYMENTS: 'Payments',
  ALIAS_WITH_PLUS_UNSUPPORTED:
    'Aliases cannot have a "+" symbol as this is a built-in filtering feature (similar to Gmail).',
  EMAIL_FAILED_TO_SEND:
    'Unfortunately an error occurred while sending the email.  Please try again or <a class="font-weight-bold" href="/help">contact us</a> for help.',
  EMAIL_CHANGE_SENT:
    'Check your inbox for a link to confirm your email change.',
  EMAIL_CHANGE_LIMIT:
    'You can only change your email address every <span class="notranslate">%s</span> minutes. Please try again <span class="notranslate">%s</span>.',
  EMAIL_CHANGE_ALREADY_EXISTS:
    'The email address <span class="notranslate">%s</span> already exists.',
  EMAIL_CHANGE_DOES_NOT_EXIST: 'Email change request does not exist.',
  EMAIL_CHANGE_CANCELLED: 'Email change request has been cancelled.',
  PAYMENT_DESCRIPTION:
    '<span class="notranslate">%s</span> payment for <span class="notranslate">%s</span> of the <span class="notranslate">%s</span> plan.',
  PAYMENT_REFERENCE_INVALID: 'Payment reference was invalid or did not exist.',
  RECEIPT: 'Receipt',
  MAKE_PAYMENT: 'Make Payment',
  DOMAIN_PLAN_UPGRADE_REQUIRED:
    'Domain name <span class="notranslate">%s</span> must have at least one admin that is signed up for the <span class="notranslate">%s</span> plan. Please <a class="font-weight-bold" href="%s">upgrade your account</a> to this plan to continue.',
  DOMAIN_PLAN_DOWNGRADE_REQUIRED:
    'Domain name <span class="notranslate">%s</span> must have at least one admin that is signed up for the <span class="notranslate">%s</span> plan. Please <a class="font-weight-bold" href="%s">downgrade this domain</a> to continue.',
  MALICIOUS_DOMAIN_PLAN_UPGRADE_REQUIRED:
    'Domain name <span class="notranslate">%s</span> has a domain name extension that is frequently used for spam operations. Please <a class="font-weight-bold" href="%s">upgrade your account</a> to a paid plan to continue.',
  MALICIOUS_DOMAIN:
    'Domain name <span class="notranslate">%s</span> has a domain name extension that is frequently abused for spam operations.  We require that users with this domain name extension upgrade to a paid plan in order to use our service.',
  UPGRADE: 'Upgrade',
  BILLING: 'Billing',
  ENABLE_AUTO_RENEW: 'Enable Auto-Renew',
  INVALID_STRIPE_SIGNATURE: 'Invalid Stripe Signature',
  INVALID_PAYPAL_SIGNATURE: 'Invalid PayPal Signature',
  SUBSCRIPTION_ALREADY_ACTIVE:
    'You have an active subscription and auto-renew is currently enabled.',
  SUBSCRIPTION_ALREADY_CANCELLED:
    'You do not currently have an active subscription, or it was recently cancelled.',
  SUBSCRIPTION_CANCELLED: 'You have successfully cancelled your subscription.',
  ONE_TIME_PAYMENT_SUCCESSFUL: 'You have successfully made a one-time payment.',
  CAPTCHA_SERVICE_ERROR: 'Captcha service error.',
  REFUND_ERROR_OCCURRED:
    'An error occurred while processing refunds. We have been notified by email.',
  REFUND_SUCCESSFUL:
    'We have successfully processed a total refunded amount of <span class="notranslate">%s</span>.',
  CONVERSION_ERROR_OCCURRED:
    'An error occurred while converting your existing credit between plans. We have been notified by email.',
  CONVERSION_SUCCESS:
    'You successfully switched plans and received a conversion credit of <span class="notranslate">%s</span>.',
  CAPTCHA_NOT_VERIFIED: 'Captcha not verified.',
  MISSING_VERIFICATION_LINK:
    'Missing "VERIFICATION_LINK" in HTML template string.  This variable must be included at least once either in text or link format.',
  PAID_PLAN_REQUIRED_FOR_RECIPIENT_VERIFICATION:
    'Paid plan is required for recipient verification',
  INVALID_RECIPIENT_VERIFICATION:
    'Invalid recipient verification request.  Please ensure the link is correct and try again, or contact us for help.',
  RECIPIENT_VERIFICATION_PENDING_DOMAIN_VERIFICATION:
    'Verification link will not be sent until the domain has verified <span class="notranslate">TXT</span> and MX records.',
  DISPOSABLE_EMAIL_NOT_ALLOWED:
    'Disposable email addresses are not allowed.  Try again or contact us for help.',
  WEBSITE_OUTAGE:
    'We are resolving an issue with our website &ndash; visit our <a href="https://status.forwardemail.net" target="_blank" rel="noopener noreferrer">Status Page</a> for updates.',
  ERRORS_OCCURRED: 'The following errors occurred:',
  RESET_TOKEN_EXPIRED:
    'The reset token has already expired. Please start a new <a href="/forgot-password">Forgot Password</a> request to continue.',
  REASSIGNED_ALIAS_OWNERSHIP:
    'We have reassigned ownership of the following aliases to you:',
  REMOVED_ALIASES_FROM_OWNER:
    'We have removed the following aliases that belonged to you:',
  REASSIGNED_ALIASES_FROM_OWNER:
    'We have reassigned the following aliases that belonged to you:',
  PAID_PLAN_HAS_UNENCRYPTED_RECORDS:
    '<strong>This domain has unencrypted aliases stored in DNS <span class="notranslate">TXT</span> records.</strong>  Follow these steps to resolve this issue:<ol class="mt-3"><li><a href="%s">Import <span class="notranslate">TXT</span> Records</a></li><li>Remove any DNS <span class="notranslate">TXT</span> records prefixed with <code class="notranslate">%s=</code> (make sure you <u>DO NOT</u> remove the existing encrypted record)</li><li>Try to <a href="%s">Verify Records</a> again</li></ol>',
  DNS_RETRY:
    'An error code of "<span class="notranslate">%s</span>" occurred while performing the DNS lookup. Please try again.',
  USER_UPGRADED_ACCOUNT_NOT_DOMAINS_MESSAGE:
    'You successfully upgraded your account &ndash; however we noticed that you have one or more domains that are not on the same plan you upgraded to. Please configure each domain to use your current plan by using the drop-down menu located at the <a href="/my-account/domains">Domains</a> page.  You can feel free to mix and match domains to be configured on different plans (e.g. you can have some on the free plan, and others on upgraded paid plans).',
  USER_UPGRADED_ACCOUNT_NOT_DOMAINS_SUBJECT:
    'Need to configure your domains to match your plan?',
  PAST_DUE_CANNOT_SWITCH:
    'In order to switch plans, you must first update your account to good standing by paying the entire past due balance. You owe payment for <span class="notranslate">%d</span> months.  You can alternatively downgrade all of your domains to the free plan.',
  PAYMENT_PAST_DUE_SUBJECT:
    'Your account is past due and API access may be restricted!',
  PAYMENT_PAST_DUE_API_RESTRICTED:
    'API access has been restricted due to past due payment',
  PAYMENT_PAST_DUE_MESSAGE:
    '<strong class="text-danger">Your account is past due.</strong> Please <a href="%s">make a payment</a> immediately to avoid account termination.',
  PAST_DUE_REQUIRED_ONE_TIME:
    'Your account is <strong class="notranslate">%s</strong> past due. You must pay this amount before you can enable auto-renew.',
  AND: 'and',
  PLAN_MORE_THAN_TWO_YEARS_FROM_EXPIRY:
    'You cannot start a subscription nor enable auto-renew more than two years from your plan\'s current expiration date of <span class="notranslate">%s</span>.  Please try again <span class="notranslate">%s</span>.',
  MONTH: 'month',
  YEAR: 'year',
  ...STATUSES
};
