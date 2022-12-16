// eslint-disable-next-line import/no-unassigned-import
require('#config/env');

const process = require('process');
const { parentPort } = require('worker_threads');

const Graceful = require('@ladjs/graceful');
const Redis = require('@ladjs/redis');
const sharedConfig = require('@ladjs/shared-config');
const validator = require('validator');

const logger = require('#helpers/logger');

const breeSharedConfig = sharedConfig('BREE');
const client = new Redis(breeSharedConfig.redis, logger);
const graceful = new Graceful({
  redisClients: [client],
  logger
});

graceful.listen();

(async () => {
  try {
    // delete all IP's prefixed with backscatter or blocklist
    // (this will ensure our latest dataset is accurate)
    const [blocklistKeys, backscatterKeys] = await Promise.all([
      client.keys('blocklist:*'),
      client.keys('backscatter:*')
    ]);
    const pipeline = client.pipeline();
    for (const key of [...blocklistKeys, ...backscatterKeys]) {
      // filter out keys to be IP addresses only
      const [, ip] = key.split(':');
      if (validator.isIP(ip)) pipeline.del(key);
    }

    await pipeline.exec();
  } catch (err) {
    logger.fatal(err);
  }

  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
