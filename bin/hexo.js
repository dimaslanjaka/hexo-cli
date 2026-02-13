// eslint-disable-next-line strict
'use strict';

if (typeof require == 'undefined') {
  import('../dist/hexo.js').then((lib) => {
    (lib.default || lib)();
  });
} else {
  const lib = require('../dist/hexo.cjs');
  (lib.default || lib)();
}
