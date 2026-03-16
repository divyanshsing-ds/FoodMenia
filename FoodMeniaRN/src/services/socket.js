import { io } from 'socket.io-client';
import { CONFIG } from '../utils/config';

// Derive base URL from API_BASE (strip the /api suffix)
const SOCKET_URL = CONFIG.API_BASE.replace('/api', '');

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
    socket.on('disconnect', () => console.log('👋 Socket disconnected'));
    socket.on('connect_error', (err) => console.log('⚠️ Socket error:', err.message));
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
