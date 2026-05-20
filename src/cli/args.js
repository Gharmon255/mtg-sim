function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const values = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      values.push(argv[i + 1]);
      i += 1;
    }
    args[key] = values.length > 1 ? values : values[0] || true;
  }
  return args;
}

function listValue(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { parseArgs, listValue };
