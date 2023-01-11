const I18N = require('@ladjs/i18n');
const isSANB = require('is-string-and-not-blank');
const { parse } = require('node-html-parser');

const phrases = require('#config/phrases');
const i18nConfig = require('#config/i18n');
const logger = require('#helpers/logger');
const markdown = require('#helpers/markdown');

// const cheerio = require('cheerio');
/*
function fixTableOfContents(content) {
  const $ = cheerio.load(content);
  const $h1 = $('h1').first();
  if ($h1.length === 0) return content;
  const $h2 = $h1.next('h2');
  if ($h2.length === 0) return content;
  const $a = $h1.find('a').first();
  if ($a.length === 0) return content;
  $a.attr('id', 'top');
  $a.attr('href', '#top');
  const $a2 = $h2.find('a').first();
  if ($a2.length === 0) return content;
  $a2.attr('id', 'table-of-contents');
  $a2.attr('href', '#table-of-contents');
  const $ul = $h2.next('ul');
  if ($ul.length === 0) return content;
  const $links = $ul.find('a');
  if ($links.length === 0) return content;
  const $h2s = $('h2');
  $links.each(function () {
    const $link = $(this);
    const text = $link.text();
    const href = $link.attr('href');
    const id = href.slice(1);
    $h2s.each(function () {
      const $h = $(this);
      const $anchor = $h.find('a').first();
      if ($anchor.length === 0) return;
      if ($h.text() === text) {
        $anchor.attr('href', href);
        // strip the # so id is accurate
        $anchor.attr('id', id);
      }
    });
  });

  return $.html();
}
*/

// eslint-disable-next-line complexity
function fixTableOfContents(content, i18n, options) {
  const root = parse(content);

  const h1 = root.querySelector('h1');
  if (!h1) return content;

  const a = h1.querySelector('a');
  if (!a) return content;

  const h2 = root.querySelector('h2');
  if (!h2) return content;

  const a2 = h2.querySelector('a');
  if (!a2) return content;

  const ul = root.querySelector('ul');
  if (!ul) return content;

  const lis = ul.querySelectorAll('li');
  if (lis.length === 0) return content;

  a.setAttribute('id', 'top');
  a.setAttribute('href', '#top');

  //
  // NOTE: we need to keep this because `mandarin` does not normalize in the
  //       same way that #helpers/markdown normalizes with github-like headings
  //       (and this also gives us the opportunity to fix the aria-hidden issue below)
  //       <https://github.com/Flet/markdown-it-github-headings/issues/20>
  //       (e.g. /en/faq does not look the same when rendered as /de/faq)
  //
  for (const header of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const anchor = header.querySelector('a');
    if (!anchor) continue;
    let id = anchor.getAttribute('id');
    if (!id && anchor.getAttribute('href'))
      id = anchor.getAttribute('href').slice(1);

    if (!id) continue;

    anchor.setAttribute('class', 'anchor');

    if (lis.length > 5) {
      // eslint-disable-next-line unicorn/prefer-dom-node-dataset
      anchor.setAttribute('data-toggle', 'collapse');
      anchor.setAttribute('role', 'button');
      anchor.setAttribute('aria-expanded', 'false');
      anchor.setAttribute('aria-controls', `collapse-${id}`);
      // eslint-disable-next-line unicorn/prefer-dom-node-dataset
      anchor.setAttribute('data-target', `#collapse-${id}`);
    }

    anchor.removeAttribute('aria-hidden');
    anchor.set_content(
      '<svg aria-hidden="true" class="octicon octicon-link" height="16" version="1.1" viewBox="0 0 16 16" width="16"><path d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg>'
    );

    //
    // if this header was an <h2> then we can assume it to be table of contents
    // and for each next sibling element, up until the next <h2> we push it to an array
    // of nodes, and then we replace all these nodes with one combined node wrapped in a div
    // (similar to this example: <https://stackoverflow.com/a/7968463>)
    //
    if (
      lis.length > 5 &&
      header.rawTagName === 'h2' &&
      (!header.nextElementSibling ||
        (header.nextElementSibling && header.nextElementSibling !== ul)) &&
      id !== 'table-of-contents'
    ) {
      //
      // get the child node of the header that is a text node (nodeType === 3)
      // and then replace it with an anchor tag wrapped and custom styled
      // a.btn.btn-link.btn-block.text-left.text-dark.font-weight-bold.p-0
      //

      // replace the text node
      const lastChildRawText = header.lastChild.rawText;
      // eslint-disable-next-line unicorn/prefer-dom-node-remove
      header.removeChild(header.lastChild);

      // add a question mark as well as collapse styling
      // eslint-disable-next-line unicorn/prefer-dom-node-append
      header.appendChild(
        parse(
          `<a class="dropdown-toggle text-wrap btn btn-link btn-block text-left text-dark font-weight-bold p-0" href="#${id}" data-toggle="collapse" role="button" aria-expanded="false" aria-controls="collapse-${id}" data-target="#collapse-${id}">${lastChildRawText}${
            options.isFAQ && !lastChildRawText.endsWith('?') ? '?' : ''
          }</a>`
        )
      );

      let node = header;
      let html = '';
      const nodes = [];
      while (
        node.nextElementSibling &&
        node.nextElementSibling.rawTagName !== 'h2'
      ) {
        node = node.nextElementSibling;
        html += node.toString();
        nodes.push(node);
      }

      //
      // get outer HTML of all these nodes joined together
      // and then remove all of the nodes
      // and then after the current <h2> we need to append it wrapped
      //
      for (const node of nodes) {
        node.remove();
      }

      header.replaceWith(
        header.toString() +
          `<div class="collapse" id="collapse-${id}">${html}</div>`
      );
    }
  }

  const h2s = root.querySelectorAll('h2');

  for (const li of lis) {
    const a = li.querySelector('a');
    const { text } = a;
    const href = a.getAttribute('href');
    const id = href.slice(1);
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    a.setAttribute('data-dismiss', 'modal');
    a.setAttribute('aria-controls', `collapse-${id}`);
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    a.setAttribute('data-target', `#collapse-${id}`);
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    a.setAttribute('data-toggle', 'collapse');
    a.setAttribute('class', 'list-group-item list-group-item-action');
    // add a question mark
    a.firstChild._rawText = `${a.firstChild._rawText}${
      options.isFAQ && !a.firstChild._rawText.endsWith('?') ? '?' : ''
    }`;
    for (const h of h2s) {
      const anchor = h.querySelector('a');
      if (!anchor) continue;
      if (h.text === text) {
        anchor.setAttribute('href', href);
        // strip the # so id is accurate
        anchor.setAttribute('id', id);
      }
    }

    li.replaceWith(a);
  }

  const str = i18n.api.t({
    phrase: phrases.TABLE_OF_CONTENTS,
    locale: (options && options.locale) || i18n.getLocale()
  });

  ul.rawTagName = 'div';
  ul.setAttribute('class', 'list-group');

  const ulStr = ul.toString();
  h2.remove();
  ul.remove();

  const search = i18n.api.t({
    phrase: phrases.SEARCH_PAGE,
    locale: (options && options.locale) || i18n.getLocale()
  });

  if (lis.length <= 5)
    return `<div class="markdown-body">${root.toString()}</div>`;

  return `
    <div class="fixed-bottom bg-dark border-top border-light p-2 text-center is-bot no-js">
      <ul class="list-inline mb-0">
        <li class="list-inline-item text-white">
          ${search}
        </li>
        <li class="list-inline-item"><i class="fa fa-angle-right align-middle text-white"></i></li>
        <li class="list-inline-item">
          <a data-toggle="modal-anchor" data-target="#modal-table-of-contents" class="btn btn-success">
            <i class="fa fa-search"></i> ${str}
          </a>
        </li>
      </ul>
    </div>
    <div class="modal fade" id="modal-table-of-contents" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header text-center d-block">
            <div class="h4 d-inline-block ml-4">${str}</div>
            <button class="close" type="button" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
          </div>
          <div class="modal-body">${ulStr}</div>
        </div>
      </div>
    </div>
    <div class="markdown-body">${root.toString()}</div>
  `;
}

//
// NOTE: we want our own instance of i18n that does not auto reload files
//
const i18n = new I18N({
  ...i18nConfig,
  autoReload: false,
  updateFiles: false,
  syncFiles: false,
  logger
});

module.exports = {
  md(string, options) {
    if (typeof options !== 'object' || !isSANB(options.locale))
      return fixTableOfContents(markdown.render(string), i18n, options);
    return fixTableOfContents(
      i18n.api.t({
        phrase: markdown.render(string),
        locale: (options && options.locale) || i18n.getLocale()
      }),
      i18n,
      options
    );
  }
};
