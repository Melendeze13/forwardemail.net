async function listAliases(ctx) {
  if (ctx.accepts('html')) return ctx.render('my-account/domains/aliases');

  const table = await ctx.render('my-account/domains/aliases/_table');

  ctx.body = { table };
}

module.exports = listAliases;
