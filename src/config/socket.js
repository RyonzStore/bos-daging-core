import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.owner = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid Token'));
    }
  });

  return io;
}

export function getIO() {
  return io;
}
