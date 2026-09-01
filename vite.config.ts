import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile, spawn } from 'child_process';

/**
 * Validates whether an incoming HTTP request originates strictly from a local loopback address.
 */
function isLocalRequest(req: any): boolean {
  const remoteIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return (
    remoteIp === '127.0.0.1' ||
    remoteIp === '::1' ||
    remoteIp === '::ffff:127.0.0.1' ||
    remoteIp === 'localhost' ||
    remoteIp.endsWith('127.0.0.1')
  );
}

/**
 * Validates file and directory paths passed to the MTGA service to prevent arbitrary file reading.
 */
function isValidMtgaPath(inputPath: string, type: 'db' | 'log'): boolean {
  if (!inputPath || typeof inputPath !== 'string') return false;
  if (inputPath.includes('\0')) return false;

  const resolved = path.resolve(inputPath);
  const lower = resolved.toLowerCase();

  // Block sensitive operating system root paths
  const forbiddenPrefixes = [
    'c:\\windows',
    'c:\\winnt',
    'c:\\program files\\windows',
    '/etc',
    '/proc',
    '/sys',
    '/var',
    '/dev',
    '/bin',
    '/sbin',
    '/usr/bin'
  ];

  if (forbiddenPrefixes.some(prefix => lower.startsWith(prefix))) {
    return false;
  }

  if (type === 'db') {
    const ext = path.extname(resolved).toLowerCase();
    // Allow empty ext if it points to a directory (which Python parser handles), or MTGA sqlite/database extensions
    if (ext && ext !== '.mtga' && ext !== '.sqlite') {
      return false;
    }
    return true;
  } else if (type === 'log') {
    const ext = path.extname(resolved).toLowerCase();
    const basename = path.basename(resolved).toLowerCase();
    if (ext !== '.log' && ext !== '.txt') {
      return false;
    }
    if (!basename.startsWith('player')) {
      return false;
    }
    return true;
  }

  return false;
}

function mtgaLogPlugin() {
  return {
    name: 'mtga-log-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/mtga/cards', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');

        // Enforce loopback access only
        if (!isLocalRequest(req)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Access denied: local requests only' }));
          return;
        }

        // Enforce GET method only
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          res.end(JSON.stringify({ error: 'Method Not Allowed. Use GET.' }));
          return;
        }

        const urlObj = new URL(req.url, 'http://127.0.0.1:3000');
        const customDbPath = urlObj.searchParams.get('dbPath') || process.env.MTGA_DB_PATH || '';
        const customLogPath = urlObj.searchParams.get('logPath') || process.env.MTGA_LOG_PATH || '';

        // Validate paths against traversal / unauthorized system file access
        if (customDbPath && !isValidMtgaPath(customDbPath, 'db')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid or disallowed MTGA database path.' }));
          return;
        }

        if (customLogPath && !isValidMtgaPath(customLogPath, 'log')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid or disallowed MTGA log path.' }));
          return;
        }

        const scriptPath = path.resolve(__dirname, 'services/parse_mtga.py');
        const args = [scriptPath];
        if (customDbPath) args.push(customDbPath);
        if (customLogPath) args.push(customLogPath);

        execFile('python', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            console.error('[MTGA Plugin Error]:', err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process MTG Arena data.' }));
            return;
          }
          try {
            // Ensure response is valid JSON before sending
            JSON.parse(stdout);
            res.end(stdout);
          } catch {
            console.error('[MTGA Plugin JSON Parse Error]');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Invalid response format from MTG Arena parser.' }));
          }
        });
      });
    }
  };
}

let lastOllamaSpawnTime = 0;

function ollamaServerPlugin() {
  return {
    name: 'ollama-server-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/ollama/start', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');

        // Enforce loopback access only
        if (!isLocalRequest(req)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Access denied: local requests only' }));
          return;
        }

        // Enforce POST method only
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
          return;
        }

        // Throttle/debounce process launches (5s cooldown)
        const now = Date.now();
        if (now - lastOllamaSpawnTime < 5000) {
          res.statusCode = 429;
          res.end(JSON.stringify({
            status: 'in_progress',
            message: 'Ollama launch request is already in progress.'
          }));
          return;
        }
        lastOllamaSpawnTime = now;

        try {
          // Launch 'ollama serve' as a detached child process without shell execution
          const ollamaProc = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore',
            shell: false
          });

          ollamaProc.on('error', (err) => {
            console.error('[Ollama Plugin Spawn Error]:', err.message);
          });

          ollamaProc.unref();

          res.end(JSON.stringify({
            status: 'success',
            message: 'Ollama serve process launched in background.'
          }));
        } catch (err: any) {
          console.error('[Ollama Plugin Exception]:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({
            status: 'error',
            error: 'Could not start Ollama process.'
          }));
        }
      });
    }
  };
}

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    // Never embed local environment GEMINI_API_KEY into static production bundles
    const geminiApiKey = command === 'serve' ? (env.GEMINI_API_KEY || '') : '';

    return {
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react(), mtgaLogPlugin(), ollamaServerPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
