import { io } from 'socket.io-client';

const BASE_URL_RAW = process.env.REACT_APP_BASE_URL || 'http://localhost:4000/';
const BASE_URL = BASE_URL_RAW.endsWith('/') ? BASE_URL_RAW : `${BASE_URL_RAW}/`;

// Create a single shared Socket.IO client
export const socket = io(BASE_URL, {
    withCredentials: true,
    autoConnect: true,
});

// Optional helper to subscribe to new chat messages
export const subscribeToNewMessages = (handler) => {
    if (!socket) return;
    socket.on('chat:newMessage', handler);
    return () => {
        socket.off('chat:newMessage', handler);
    };
};


