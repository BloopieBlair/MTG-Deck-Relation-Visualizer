import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile, spawn } from 'child_process';

function mtgaLogPlugin() {
  return {
    name: 'mtga-log-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/mtga/cards', (req: any, res: any) => {
        const urlObj = new URL(req.url, 'http://localhost:3000');
        const customDbPath = urlObj.searchParams.get('dbPath') || process.env.MTGA_DB_PATH || '';
        const customLogPath = urlObj.searchParams.get('logPath') || process.env.MTGA_LOG_PATH || '';
        const scriptPath = path.resolve(__dirname, 'services/parse_mtga.py');
        
        const args = [scriptPath];
        if (customDbPath) args.push(customDbPath);
        if (customLogPath) args.push(customLogPath);

        execFile('python', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message, stderr }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(stdout);
        });
      });
    }
  };
}

function ollamaServerPlugin() {
  return {
    name: 'ollama-server-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/ollama/start', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          // Launch 'ollama serve' in background detached process
          const ollamaProc = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore',
            shell: true
          });
          ollamaProc.unref();

          res.end(JSON.stringify({
            status: 'success',
            message: 'Ollama serve process launched in background.'
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({
            status: 'error',
            error: err.message || 'Could not start Ollama process.'
          }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), mtgaLogPlugin(), ollamaServerPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
