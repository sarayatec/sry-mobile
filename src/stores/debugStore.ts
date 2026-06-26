import { create } from 'zustand';

const MAX_LINES = 200;

export type MediaStatus = 'unknown' | 'ok' | 'denied' | 'error';
export type FgsStatus = 'unknown' | 'running' | 'failed' | 'crashed';
export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type TurnStatus = 'untested' | 'ok' | 'failed';

interface DebugState {
  cameraStatus: MediaStatus;
  micStatus: MediaStatus;
  fgsStatus: FgsStatus;
  socketStatus: SocketStatus;
  socketId: string;
  iceState: string;
  turnState: TurnStatus;
  permissions: Record<string, string>;
  wakeLockHeld: boolean;
  sessionId: string;
  currentException: string | null;
  logs: string[];
}

interface DebugActions {
  addLog(line: string): void;
  setCamera(status: MediaStatus): void;
  setMic(status: MediaStatus): void;
  setFgs(status: FgsStatus): void;
  setSocket(status: SocketStatus, id?: string): void;
  setIce(state: string): void;
  setTurn(status: TurnStatus): void;
  setPermissions(perms: Record<string, string>): void;
  setWakeLock(held: boolean): void;
  setSessionId(id: string): void;
  setException(err: string | null): void;
  clearLogs(): void;
}

export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  cameraStatus: 'unknown',
  micStatus: 'unknown',
  fgsStatus: 'unknown',
  socketStatus: 'disconnected',
  socketId: '',
  iceState: 'new',
  turnState: 'untested',
  permissions: {},
  wakeLockHeld: false,
  sessionId: 'none',
  currentException: null,
  logs: [],

  addLog: (line) => set((s) => ({
    logs: s.logs.length >= MAX_LINES
      ? [...s.logs.slice(s.logs.length - MAX_LINES + 1), line]
      : [...s.logs, line],
  })),
  setCamera: (cameraStatus) => set({ cameraStatus }),
  setMic: (micStatus) => set({ micStatus }),
  setFgs: (fgsStatus) => set({ fgsStatus }),
  setSocket: (socketStatus, socketId = '') => set({ socketStatus, socketId }),
  setIce: (iceState) => set({ iceState }),
  setTurn: (turnState) => set({ turnState }),
  setPermissions: (permissions) => set({ permissions }),
  setWakeLock: (wakeLockHeld) => set({ wakeLockHeld }),
  setSessionId: (sessionId) => set({ sessionId }),
  setException: (currentException) => set({ currentException }),
  clearLogs: () => set({ logs: [] }),
}));
