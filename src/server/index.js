const fs = require('fs');
const http = require('http');
const path = require('path');
const { createSimulatorService } = require('./simulatorService');

const PORT = Number(process.env.PORT || 3001);
const DIST_DIR = path.join(process.cwd(), 'dist');
const apiOnly = process.argv.includes('--apiOnly');
const service = createSimulatorService();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) {
      await handleApi(request, response);
      return;
    }

    if (apiOnly) {
      sendJson(response, 200, { ok: true, message: 'Commander simulator API is running.' });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  const mode = apiOnly ? 'API' : 'web';
  console.log(`Commander simulator ${mode} server running at http://127.0.0.1:${PORT}`);
  if (!apiOnly && !fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log('No dist build found yet. Run "npm run build" before using npm start, or run "npm run api" plus "npm run dev".');
  }
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/decks') {
    sendJson(response, 200, { decks: service.listDecks() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/decks/import') {
    sendJson(response, 200, await service.importDeckText(await readJson(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/decks/delete') {
    sendJson(response, 200, service.deleteDeck(await readJson(request)));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/precons') {
    sendJson(response, 200, service.listPrecons());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/precons/import') {
    sendJson(response, 200, await service.importPrecons());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/wizards/search') {
    sendJson(response, 200, await service.searchWizards(url.searchParams.get('query') || ''));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/wizards/import') {
    sendJson(response, 200, await service.importWizards(await readJson(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/cards/hydrate') {
    sendJson(response, 200, await service.hydrateCards(await readJson(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/validate') {
    sendJson(response, 200, service.validate(await readJson(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/analyze') {
    sendJson(response, 200, service.analyze(await readJson(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/simulate') {
    sendJson(response, 200, service.simulate(await readJson(request)));
    return;
  }

  sendJson(response, 404, { error: 'API route not found.' });
}

function serveStatic(request, response) {
  let requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (requestPath === '/') requestPath = '/index.html';

  const filePath = path.normalize(path.join(DIST_DIR, requestPath));
  if (!filePath.startsWith(DIST_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(DIST_DIR, 'index.html');

  if (!fs.existsSync(finalPath)) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<h1>Build required</h1><p>Run <code>npm run build</code>, then restart <code>npm start</code>. For development, run <code>npm run api</code> and <code>npm run dev</code>.</p>');
    return;
  }

  const extension = path.extname(finalPath);
  response.writeHead(200, { 'Content-Type': MIME_TYPES[extension] || 'application/octet-stream' });
  fs.createReadStream(finalPath).pipe(response);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}
