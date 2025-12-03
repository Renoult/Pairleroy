import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from 'serve-handler';
import { WebSocketServer, WebSocket } from 'ws';

const HOST = process.env.HOST || 'localhost';
const PORT = Number(process.env.PORT || 3000);
const WS_PATH = '/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..');

const server = createServer((req, res) => handler(req, res, { public: publicDir }));

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    // Normaliser en texte (JSON) pour que les navigateurs ne reçoivent pas de Blob
    const payload = typeof data === 'string' ? data : data.toString();
    // Relay to everyone else (simple fan-out, no persistence)
    wss.clients.forEach((client) => {
      if (client === socket) return;
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload, { binary: false });
      }
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Pairleroy served at http://${HOST}:${PORT}`);
  console.log(`WebSocket sync endpoint available at ws://${HOST}:${PORT}${WS_PATH}`);
});
