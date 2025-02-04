const Router = require('@koa/router');

const v1 = require('./v1');

const router = new Router();

router
  // status page crawlers often send `HEAD /` requests
  .get('/', (ctx) => {
    ctx.body = 'OK';
  })
  .use(v1.routes());

module.exports = router;
