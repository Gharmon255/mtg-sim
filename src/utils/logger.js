const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

function createLogger(level) {
  const configured = level || process.env.LOG_LEVEL || 'info';
  const threshold = LEVELS[configured] === undefined ? LEVELS.info : LEVELS[configured];

  function shouldLog(name) {
    return LEVELS[name] <= threshold;
  }

  return {
    error: (...args) => shouldLog('error') && console.error(...args),
    warn: (...args) => shouldLog('warn') && console.warn(...args),
    info: (...args) => shouldLog('info') && console.log(...args),
    debug: (...args) => shouldLog('debug') && console.log(...args)
  };
}

module.exports = { createLogger };
