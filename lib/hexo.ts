import Promise from 'bluebird';
import { camelCaseKeys } from 'hexo-util';
import minimist from 'minimist';
import * as picocolors from 'picocolors';
import resolve from 'resolve';
import tildify from 'tildify';
import helpConsole from './console/help.js';
import registerConsole from './console/index.js';
import initConsole from './console/init.js';
import versionConsole from './console/version.js';
import Context from './context.js';
import findPkg from './find_pkg.js';
import goodbye from './goodbye.js';

class HexoNotFoundError extends Error {}

function entry(cwd = process.cwd(), args: Record<string, any> | null = null) {
  args = camelCaseKeys(args || minimist(process.argv.slice(2), { string: ['_', 'p', 'path', 's', 'slug'] }));

  let hexo = new Context(cwd, args);
  let { log } = hexo;

  // Change the title in console
  process.title = 'hexo';

  function handleError(err: Error | null) {
    if (err && !(err instanceof HexoNotFoundError)) {
      log.fatal(err);
    }

    process.exitCode = 2;
  }

  return findPkg(cwd, args)
    .then((path) => {
      if (!path) return;

      hexo.base_dir = path;

      return loadModule(path, args).catch((err: Error) => {
        log.error(err.message);
        log.error('Local hexo loading failed in %s', picocolors.magenta(tildify(path)));
        log.error("Try running: 'rm -rf node_modules && npm install --force'");
        throw new HexoNotFoundError();
      });
    })
    .then((mod) => {
      if (mod) hexo = mod;
      log = hexo.log;

      registerConsole(hexo);

      return hexo.init();
    })
    .then(() => {
      let cmd = 'help';

      if (!args.h && !args.help) {
        const c = args._.shift();
        if (c && hexo.extend.console.get(c)) cmd = c;
      }

      watchSignal(hexo);

      return hexo
        .call(cmd, args)
        .then(() => hexo.exit())
        .catch((err: Error) =>
          hexo.exit(err).then(() => {
            // `hexo.exit()` already dumped `err`
            handleError(null);
          })
        );
    })
    .catch(handleError);
}

entry.console = {
  init: initConsole,
  help: helpConsole,
  version: versionConsole
};

entry.version = '__VERSION__';

function loadModule(path: string, args: Record<string, any>) {
  return Promise.try(() => {
    const modulePath = resolve.sync('hexo', { basedir: path });
    const Hexo = require(modulePath);

    return new Hexo(path, args);
  });
}

function watchSignal(hexo: Context) {
  process.on('SIGINT', () => {
    hexo.log.info(goodbye());
    hexo.unwatch();

    hexo.exit().then(() => {
      // eslint-disable-next-line n/no-process-exit
      process.exit();
    });
  });
}

export default entry;
