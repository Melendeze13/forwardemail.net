const process = require('process');
const path = require('path');
const fs = require('fs');

// required to disable watching of I18N files in @ladjs/i18n
// otherwises tasks will fail to exit due to watchers running
process.env.I18N_SYNC_FILES = true;
process.env.I18N_AUTO_RELOAD = false;
process.env.I18N_UPDATE_FILES = true;

// eslint-disable-next-line import/no-unassigned-import
require('#config/env');

// eslint-disable-next-line import/no-unassigned-import
require('#config/mongoose');

const Graceful = require('@ladjs/graceful');
const Mandarin = require('mandarin');
const RevAll = require('gulp-rev-all');
const babel = require('gulp-babel');
const browserify = require('browserify');
const concat = require('gulp-concat');
const cssnano = require('cssnano');
const del = require('del');
const envify = require('@ladjs/gulp-envify');
const getStream = require('get-stream');
const globby = require('globby');
const gulpRemark = require('gulp-remark');
const gulpXo = require('gulp-xo');
const filter = require('gulp-filter');
const imagemin = require('gulp-imagemin');
const isCI = require('is-ci');
const lr = require('gulp-livereload');
const makeDir = require('make-dir');
const nodeSass = require('node-sass');
const order = require('gulp-order');
const pngquant = require('imagemin-pngquant');
const postcss = require('gulp-postcss');
const postcssPresetEnv = require('postcss-preset-env');
const prettier = require('gulp-prettier');
const pugLinter = require('gulp-pug-linter');
const pump = require('pump');
const purgeFromPug = require('purgecss-from-pug');
const purgecss = require('gulp-purgecss');
const reporter = require('postcss-reporter');
const rev = require('gulp-rev');
const revSri = require('gulp-rev-sri');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const stylelint = require('@ronilaukkarinen/gulp-stylelint');
const terser = require('gulp-terser');
const through2 = require('through2');
const unassert = require('gulp-unassert');
const { lastRun, watch, series, parallel, src, dest } = require('gulp');

// explicitly set the compiler in case it were to change to dart
sass.compiler = nodeSass;

const env = require('#config/env');
const config = require('#config');
const logger = require('#helpers/logger');
const i18n = require('#helpers/i18n');

const PROD = config.env === 'production';
const DEV = config.env === 'development';
const TEST = config.env === 'test';

const CONCAT_CSS_ORDER = [
  `${config.buildBase}/css/app-light.css`,
  `${config.buildBase}/css/app-dark.css`
];

const staticAssets = [
  'assets/**/*',
  '!assets/css/**/*',
  '!assets/img/**/*',
  '!assets/js/**/*'
];

const purgeCssOptions = {
  content: [
    'build/**/*.js',
    'app/views/**/*.md',
    'app/views/**/*.pug',
    'emails/**/*.pug'
  ],
  // <https://github.com/FullHuman/purgecss/blob/55c26d2790b8502f115180cfe02aba5720c84b7b/docs/configuration.md>
  defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
  extractors: [
    {
      extractor: purgeFromPug,
      extensions: ['pug']
    }
  ],
  sourceMap: false,
  // (since this does not detect variable-based class names in pug files)
  // the following list was filtered from `rg "class=" app/views/**/*.pug`
  safelist: [
    'active',
    'alert-danger',
    'alert-success',
    'anchor',
    'badge-danger',
    'badge-primary',
    'badge-success',
    'badge-warning',
    'bg-danger',
    'bg-dark',
    'bg-secondary',
    'bg-success',
    'bg-warning',
    'bg-white',
    'border-dark',
    'border-md-top',
    'btn-link',
    'col',
    'col-12',
    'col-6',
    'col-lg-6',
    'col-md-6',
    'col-md-8',
    'col-sm-12',
    'confirm-prompt',
    'container',
    'container-fluid',
    'd-inline-block',
    'd-md-inline-block',
    'd-none',
    'd-print-block',
    'd-sm-block',
    'disabled',
    'email',
    'fa-check',
    'fa-search',
    'fa-sort',
    'fa-sort-down',
    'fa-sort-up',
    'fa-times',
    'flex-grow-1',
    'floating-label',
    'font-weight-bold',
    'lazyframe',
    'markdown-body',
    'mb-0',
    'mt-3',
    'mt-md-0',
    'navbar-dark',
    'navbar-light',
    'navbar-themed',
    'octicon-link',
    'offset-lg-3',
    'offset-md-2',
    'opacity-50',
    'py-3',
    'row',
    'table-danger',
    'table-success',
    'text-center',
    'text-danger',
    'text-dark',
    'text-decoration-underline',
    'text-muted',
    'text-success',
    'text-warning',
    'text-white',
    /^hljs/,
    /^language-/,
    /-themed$/,
    /-themed-/
  ]
};

//
// add a logger pre-hook to always ignore_hook so post-hooks don't fire
// (but only for development and testing environments)
//
if (!PROD) {
  for (const level of logger.config.logger.config.levels) {
    logger.config.logger.pre(level, function (err, message, meta) {
      meta.ignore_hook = true;
      return [err, message, meta];
    });
  }
}

function pug() {
  let stream = src(['app/views/**/*.pug', 'emails/**/*.pug'], {
    since: lastRun(pug)
  })
    .pipe(prettier())
    .pipe(pugLinter({ reporter: 'default', failAfterError: true }));

  if (DEV) stream = stream.pipe(lr(config.livereload));

  return stream;
}

function img() {
  let stream = src('assets/img/**/*', {
    base: 'assets',
    since: lastRun(img)
  })
    .pipe(
      imagemin({
        progressive: true,
        svgoPlugins: [{ removeViewBox: false }, { cleanupIDs: false }],
        use: [pngquant()]
      })
    )
    .pipe(dest(config.buildBase));

  if (DEV) stream = stream.pipe(lr(config.livereload));
  return stream;
}

function fonts() {
  return src('assets/fonts/**/*', {
    base: 'assets',
    since: lastRun(fonts)
  }).pipe(dest(config.buildBase));
}

function faFonts() {
  return src(['node_modules/@fortawesome/fontawesome-free/webfonts/**/*']).pipe(
    dest(path.join(config.buildBase, 'fonts'))
  );
}

function css() {
  const f = filter(CONCAT_CSS_ORDER);
  return pump(
    [
      src('assets/css/**/*.scss', {
        base: 'assets'
      }),
      stylelint({
        reporters: [{ formatter: 'string', console: true }]
      }),
      // sourcemaps.init()
      sass().on('error', sass.logError),
      postcss([
        postcssPresetEnv({ browsers: 'extends @ladjs/browserslist-config' }),
        cssnano({ autoprefixer: false }),
        reporter()
      ]),
      purgecss(purgeCssOptions),
      dest(config.buildBase),
      ...(DEV ? [lr(config.livereload)] : []),
      // sourcemaps.write('./')
      f,
      order(CONCAT_CSS_ORDER, { base: './' }),
      concat('css/app.css'),
      postcss([
        postcssPresetEnv({ browsers: 'extends @ladjs/browserslist-config' }),
        cssnano({ autoprefixer: false }),
        reporter()
      ]),
      purgecss(purgeCssOptions),
      dest(config.buildBase),
      ...(DEV ? [lr(config.livereload)] : [])
    ],
    (err) => {
      if (err) throw err;
    }
  );
}

function xo() {
  return src('.', { since: lastRun(xo) })
    .pipe(gulpXo({ quiet: true, fix: true }))
    .pipe(gulpXo.format())
    .pipe(gulpXo.failAfterError());
}

// TODO: in the future use merge-streams and return a stream w/o through2
async function bundle() {
  const since = lastRun(bundle);
  const polyfillPath = path.join(config.buildBase, 'js', 'polyfill.js');
  const lazyloadPath = path.join(config.buildBase, 'js', 'lazyload.js');
  const factorBundlePath = path.join(
    config.buildBase,
    'js',
    'factor-bundle.js'
  );

  await makeDir(path.join(config.buildBase, 'js'));

  async function getFactorBundle() {
    const paths = await globby('**/*.js', { cwd: 'assets/js' });
    const factorBundle = await new Promise((resolve, reject) => {
      browserify({
        entries: paths.map((string) => `assets/js/${string}`),
        debug: true
      })
        .plugin('bundle-collapser/plugin')
        .plugin('factor-bundle', {
          outputs: paths.map((string) =>
            path.join(config.buildBase, 'js', string)
          )
        })
        .bundle((err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
    });
    await fs.promises.writeFile(factorBundlePath, factorBundle);
  }

  await Promise.all([
    fs.promises.copyFile(
      path.join(
        __dirname,
        'node_modules',
        '@babel',
        'polyfill',
        'dist',
        'polyfill.js'
      ),
      polyfillPath
    ),
    fs.promises.copyFile(
      path.join(__dirname, 'node_modules', 'lazyload', 'lazyload.min.js'),
      lazyloadPath
    ),
    getFactorBundle()
  ]);

  // concatenate files
  await getStream(
    src([
      'build/js/polyfill.js',
      'build/js/factor-bundle.js',
      'build/js/uncaught.js',
      'build/js/core.js'
    ])
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(concat('build.js'))
      .pipe(sourcemaps.write('./'))
      .pipe(dest(path.join(config.buildBase, 'js')))
      .pipe(through2.obj((chunk, enc, cb) => cb()))
  );

  let stream = src('build/js/**/*.js', { base: 'build', since })
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(unassert())
    .pipe(envify(env))
    .pipe(babel());

  if (PROD) stream = stream.pipe(terser());

  stream = stream.pipe(sourcemaps.write('./')).pipe(dest(config.buildBase));

  if (DEV) stream = stream.pipe(lr(config.livereload));

  stream = stream.pipe(dest(config.buildBase));

  // convert to conventional stream
  stream = stream.pipe(through2.obj((chunk, enc, cb) => cb()));

  await getStream(stream);
}

function remark() {
  return src('.', { since: lastRun(remark) })
    .pipe(
      gulpRemark({
        quiet: true,
        frail: true
      })
    )
    .pipe(dest('.'));
}

function static() {
  return src(staticAssets, {
    base: 'assets',
    allowEmpty: true,
    since: lastRun(static),
    dot: true
  }).pipe(dest(config.buildBase));
}

async function markdown() {
  const mandarin = new Mandarin({
    i18n,
    logger,
    ...(isCI ? { redis: false } : {})
  });
  const graceful = new Graceful({
    ...(isCI ? {} : { redisClients: [mandarin.redisClient] }),
    logger
  });
  graceful.listen();
  await mandarin.markdown();
  await graceful.stopRedisClients();
}

async function sri() {
  await getStream(
    src('build/**/*.{css,js}')
      .pipe(RevAll.revision())
      .pipe(dest(config.buildBase))
      .pipe(RevAll.manifestFile())
      .pipe(dest(config.buildBase))
      .pipe(revSri({ base: config.buildBase }))
      .pipe(dest(config.buildBase))
      // convert to conventional stream
      .pipe(through2.obj((chunk, enc, cb) => cb()))
  );

  //
  // get all non css and non js files since rev-all ignores others
  // and merge rev-manifest.json with fonts and other non rev-all assets
  //
  // <https://github.com/smysnk/gulp-rev-all/blob/7fc61344df3b4377bf54b70d938cda8771096ebb/revisioner.js#L24
  // <https://github.com/smysnk/gulp-rev-all/issues/106>
  // <https://github.com/smysnk/gulp-rev-all/issues/165#issuecomment-338064409>
  //
  // note that we don't pipe fonts through gulp rev due to binary issues
  //
  await getStream(
    src([
      'build/**/*',
      '!build/**/*.{css,js}',
      '!build/fonts/**/*',
      '!build/robots.txt',
      '!build/browserconfig.xml'
    ])
      .pipe(rev())
      .pipe(dest(config.buildBase))
      .pipe(
        rev.manifest(config.manifest, {
          merge: true,
          base: config.buildBase
        })
      )
      .pipe(revSri({ base: config.buildBase }))
      .pipe(dest(config.buildBase))
      // convert to conventional stream
      .pipe(through2.obj((chunk, enc, cb) => cb()))
  );
}

function clean() {
  return del([config.buildBase]);
}

const build = series(
  clean,
  parallel(
    ...(TEST ? [] : [xo, remark]),
    series(parallel(img, static, markdown, bundle, fonts, faFonts, css), sri)
  )
);

module.exports = {
  clean,
  build,
  bundle,
  sri,
  markdown,
  watch() {
    lr.listen(config.livereload);
    watch(['**/*.js', '!gulpfile.js', '!assets/js/**/*.js'], xo);
    watch(Mandarin.DEFAULT_PATTERNS, markdown);
    watch('assets/img/**/*', img);
    watch('assets/fonts/**/*', fonts);
    watch('assets/css/**/*.scss', css);
    watch('assets/js/**/*.js', series(xo, bundle));
    watch(['app/views/**/*.pug', 'emails/**/*.pug'], pug);
    watch(staticAssets, static);
  },
  pug,
  img,
  xo,
  static,
  remark,
  fonts,
  faFonts,
  css
};

exports.default = build;
