import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import sessionRoutes from './routes/sessions.js';
import { attachSocketHandlers } from './socket.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
});
attachSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));