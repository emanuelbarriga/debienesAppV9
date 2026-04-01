import { EventEmitter } from 'events';

// Increase the default limit for all EventEmitter instances
EventEmitter.defaultMaxListeners = 20;

// Optional: Create a function to set custom limits for specific emitters
export function configureEventEmitter(emitter: EventEmitter, limit: number) {
  emitter.setMaxListeners(limit);
}
