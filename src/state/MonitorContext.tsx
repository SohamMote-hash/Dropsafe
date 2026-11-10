import { createContext, useContext, type ReactNode } from 'react';
import { useMonitor, type MonitorApi } from './useMonitor';

const MonitorContext = createContext<MonitorApi | null>(null);

export function MonitorProvider({ children }: { children: ReactNode }) {
  const api = useMonitor();
  return <MonitorContext.Provider value={api}>{children}</MonitorContext.Provider>;
}

export function useMonitorContext(): MonitorApi {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error('useMonitorContext must be used inside <MonitorProvider>');
  return ctx;
}
