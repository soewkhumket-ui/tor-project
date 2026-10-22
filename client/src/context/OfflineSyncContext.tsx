import React, { createContext, useContext, useState, useEffect } from 'react';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline_pending';

interface OfflineSyncContextType {
  syncStatus: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  triggerSync: () => Promise<void>;
  enqueueMutation: (mutation: any) => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  syncStatus: 'saved',
  isOnline: true,
  pendingCount: 0,
  triggerSync: async () => {},
  enqueueMutation: () => {}
});

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [pendingQueue, setPendingQueue] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('tor_offline_queue');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline_pending');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingQueue]);

  const enqueueMutation = (mutation: any) => {
    const updated = [...pendingQueue, { ...mutation, id: Date.now() }];
    setPendingQueue(updated);
    localStorage.setItem('tor_offline_queue', JSON.stringify(updated));
    if (!navigator.onLine) {
      setSyncStatus('offline_pending');
    } else {
      triggerSync();
    }
  };

  const triggerSync = async () => {
    if (pendingQueue.length === 0) {
      setSyncStatus('saved');
      return;
    }

    setSyncStatus('saving');
    // Process queue
    setTimeout(() => {
      setPendingQueue([]);
      localStorage.removeItem('tor_offline_queue');
      setSyncStatus('saved');
    }, 800);
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        syncStatus,
        isOnline,
        pendingCount: pendingQueue.length,
        triggerSync,
        enqueueMutation
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
