/* eslint-disable n/no-unsupported-features/node-builtins */

const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { registerHooks } = require('node:module');
const pc = require('picocolors');

// assign global __dirname for tsx to work properly
// globalThis.__dirname ??= path.join(process.cwd(), 'tmp/test');

const log = {
  info: message => console.error(
    `${pc.gray(new Date().toISOString())} ${pc.green('[resolve-ts]')} ${message}`
  ),
  warn: message => console.error(
    `${pc.gray(new Date().toISOString())} ${pc.yellow('[resolve-ts]')} ${message}`
  ),
  error: (message, error) => {
    console.error(
      `${pc.gray(new Date().toISOString())} ${pc.red('[resolve-ts]')} ${pc.red(message)}`
    );

    if (error) {
      console.error(pc.red(error.stack || error.message || String(error)));
    }
  }
};

function findTsSource(request, parent) {
  if (
    typeof request !== 'string'
    || !request.startsWith('.')
  ) {
    return null;
  }

  const parentDir = parent?.filename
    ? path.dirname(parent.filename)
    : process.cwd();

  const resolved = path.resolve(parentDir, request);
  const ext = path.extname(resolved);

  const base = ext === '.js'
    ? resolved.slice(0, -3)
    : ext
      ? null
      : resolved;

  if (!base) return null;

  for (const candidate of [
    `${base}.ts`,
    path.join(base, 'index.ts')
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function unwrapModuleExport(result) {
  if (
    result
    && typeof result === 'object'
    && result.__esModule
    && typeof result.default === 'function'
  ) {
    const keys = Object.keys(result).filter(key => key !== '__esModule');

    if (keys.length === 1 && keys[0] === 'default') {
      return result.default;
    }
  }

  return result;
}

function installCommonJS() {
  if (Module.prototype.require.__hexoResolveTsInstalled) return;

  const previousResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request, parent, isMain, options) {
    const tsSource = findTsSource(request, parent);

    if (tsSource) {
      return previousResolveFilename.call(this, tsSource, parent, isMain, options);
    }

    return previousResolveFilename.call(this, request, parent, isMain, options);
  };

  const originalRequire = Module.prototype.require;

  const requireWithResolvedTs = function(request) {
    return unwrapModuleExport(originalRequire.call(this, request));
  };

  requireWithResolvedTs.__hexoResolveTsInstalled = true;
  Module.prototype.require = requireWithResolvedTs;
}

function installESM() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        !specifier.startsWith('.')
        || !context.parentURL?.startsWith('file:')
      ) {
        return nextResolve(specifier, context);
      }

      const ext = path.extname(specifier);

      // Handle extensionless imports and .js imports.
      if (ext && ext !== '.js') {
        return nextResolve(specifier, context);
      }

      try {
        const parentPath = fileURLToPath(context.parentURL);
        const resolved = path.resolve(
          path.dirname(parentPath),
          specifier
        );

        const basePath = ext === '.js'
          ? resolved.slice(0, -3)
          : resolved;

        const candidates = [
          `${basePath}.ts`,
          path.join(basePath, 'index.ts')
        ];

        for (const tsPath of candidates) {
          if (fs.existsSync(tsPath) && fs.statSync(tsPath).isFile()) {
            log.info(`${specifier} -> ${tsPath}`);

            return {
              url: pathToFileURL(tsPath).href,
              shortCircuit: true
            };
          }
        }

        return nextResolve(specifier, context);
      } catch (error) {
        log.error(
          `Failed to resolve "${specifier}" from "${context.parentURL}"`,
          error
        );
        throw error;
      }
    }
  });
}

installCommonJS();
installESM();
