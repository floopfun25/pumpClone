// src/services/notificationService.ts

import mitt from 'mitt';

type Events = {
  showToast: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    duration?: number;
  };
};

const emitter = mitt<Events>();

export const notificationService = {
  on: emitter.on,
  off: emitter.off,
  emit: emitter.emit,
}; 