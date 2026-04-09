import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../services/socket.service';

interface SocketStore {
  socket: Socket | null;
  conectado: boolean;
  conectar: (codigo: string, jugadorId: string) => void;
  desconectar: () => void;
  emitir: (evento: string, payload: object) => void;
  escuchar: (evento: string, callback: (data: unknown) => void) => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  conectado: false,

  conectar: (codigo: string, jugadorId: string) => {
    const socket = getSocket();

    socket.on('connect', () => {
      set({ conectado: true });
      socket.emit('partida:unirse', { codigo, jugadorId });
    });

    socket.on('disconnect', () => {
      set({ conectado: false });
    });

    set({ socket });
  },

  desconectar: () => {
    disconnectSocket();
    set({ socket: null, conectado: false });
  },

  emitir: (evento: string, payload: object) => {
    const { socket } = get();
    socket?.emit(evento, payload);
  },

  escuchar: (evento: string, callback: (data: unknown) => void) => {
    const { socket } = get();
    socket?.on(evento, callback);
  },
}));
