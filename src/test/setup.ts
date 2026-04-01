import { vi } from 'vitest';

// Exportable mocks to control responses in tests
export const mockGetDocs = vi.fn(async (..._args: any[]) => ({ empty: true, size: 0, docs: [] }));

// Mock Firebase app layer
vi.mock('../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@example.com' } },
}));

// Mock Firestore SDK functions used in ownerAccountUtils
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  doc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(),
  })),
  addDoc: vi.fn(),
  getDocs: (...args: any[]) => mockGetDocs(...args),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

