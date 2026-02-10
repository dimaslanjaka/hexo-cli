#!/usr/bin/env node

// eslint-disable-next-line strict
'use strict';

// require('../dist/hexo.cjs')();
import('../dist/hexo.js').then(({ default: hexo }) => {
  hexo();
});
