import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const defaultExports = {
  '.': {
    import: './dist/hexo.js',
    require: './dist/hexo.cjs',
    types: './dist/hexo.d.ts'
  }
};

const libDir = path.join(__dirname, '../lib');

function addExport(relPath) {
  const normalized = relPath.split(path.sep).join('/');
  const key = `./dist/${normalized.replace(/\.(ts|js)$/, '')}`;
  const imp = `./dist/${normalized.replace(/\.ts$/, '.js')}`;
  const req = `./dist/${normalized.replace(/\.(ts|js)$/, '.cjs')}`;
  const types = `./dist/${normalized.replace(/\.(ts|js)$/, '.d.ts')}`;

  defaultExports[key] = {
    import: imp,
    require: req,
    types
  };
}

function addDirExport(relDir) {
  const normalized = relDir.split(path.sep).join('/');
  const key = `./dist/${normalized}`;
  const imp = `./dist/${normalized}/index.js`;
  const req = `./dist/${normalized}/index.cjs`;
  const types = `./dist/${normalized}/index.d.ts`;

  defaultExports[key] = {
    import: imp,
    require: req,
    types
  };
}

function processEntry(rel) {
  const full = path.join(libDir, rel);
  const stat = fs.statSync(full);
  const isDir = stat.isDirectory();

  if (isDir) {
    console.log(`Processing directory: lib/${rel} (contains ${fs.readdirSync(full).length} items)`);
  }

  if (isDir) {
    if (!path.basename(rel).startsWith('_') && !rel.includes('highlight_esm')) {
      fs.readdirSync(full).forEach((sub) => {
        processEntry(path.join(rel, sub));
      });

      // If the directory contains an index file, add a folder export pointing to it
      const indexTs = path.join(full, 'index.ts');
      const indexJs = path.join(full, 'index.js');
      if (fs.existsSync(indexTs) || fs.existsSync(indexJs)) {
        addDirExport(rel);
      }
    }
    return;
  }

  const base = path.basename(rel);
  if (!base.startsWith('_') && !rel.includes('highlight_esm')) {
    addExport(rel);
  }
}

fs.readdirSync(libDir).forEach((file) => {
  processEntry(file);
});

// Sort the exports to ensure consistent output
const sortedExports = Object.keys(defaultExports)
  .sort()
  .reduce((obj, key) => {
    obj[key] = defaultExports[key];
    return obj;
  }, {});

packageJson.exports = sortedExports;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
