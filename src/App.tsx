import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertBanner } from './components/AlertBanner';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { useToast } from './components/Toast';
import { routeFromHash, type RouteId } from './lib/routes';
import { usePageMeta } from './lib/seo';
import { ensureAudio } from './lib/sound';
import { AlertHistory } from './pages/AlertHistory';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { NotFound } from './pages/NotFound';
import { Overview } from './pages/Overview';
import { SettingsPage } from './pages/Settings';
import { MonitorProvider, useMonitorContext } from './state/MonitorContext';
import type { PageId } from './types';

function Shell() {
  const { state, alarms, actions, cloud } = useMonitorContext();
  const toast = useToast();
  const [route, setRoute] = useState<RouteId>(() => routeFromHash(window.location.hash));
  const [menuOpen, setMenuOpen] = useState(false);
  usePageMeta(route);

  const navigate = useCallback((page: PageId) => {
    setRoute(page);
    setMenuOpen(false);
    window.location.hash = page;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const lastCloudError = useRef<string | null>(null);
  useEffect(() => {
    if (!cloud.error) {
      lastCloudError.current = null;
      return;
    }
    if (cloud.error !== lastCloudError.current) {
      lastCloudError.current = cloud.error;
      toast.error(`Cloud sync: ${cloud.error}`);
    }
  }, [cloud.error, toast]);

  const cloudWasConnected = useRef(false);
  useEffect(() => {
    if (cloud.connected && !cloudWasConnected.current) {
      toast.success('Firebase cloud connection established.');
    } else if (!cloud.connected && cloudWasConnected.current) {
      toast.info('Firebase cloud connection lost. Showing the last known values.');
    }
    cloudWasConnected.current = cloud.connected;
  }, [cloud.connected, toast]);

  const previousSource = useRef(state.source);
  useEffect(() => {
    if (previousSource.current !== 'HARDWARE' && state.source === 'HARDWARE') {
      toast.success('ESP32 connected. Receiving live USB readings.');
    } else if (previousSource.current === 'HARDWARE' && state.source !== 'HARDWARE') {
      toast.info('ESP32 disconnected. Simulation mode resumed.');
    }
    previousSource.current = state.source;
  }, [state.source, toast]);

  const toggleSound = () => {
    const next = !state.settings.soundEnabled;
    if (next) ensureAudio(); // user click = allowed to start audio
    actions.updateSettings({ ...state.settings, soundEnabled: next });
  };
  const pending = state.alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="min-h-full overflow-x-clip">
      <Sidebar page={route === 'not-found' ? null : route} onNavigate={navigate} pendingAlerts={pending}
        open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="min-w-0 lg:pl-64">
        <Header soundEnabled={state.settings.soundEnabled}
          source={state.source} onToggleSound={toggleSound}
          onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto min-w-0 max-w-7xl space-y-5 px-4 py-5 sm:px-6">
          {route !== 'not-found' && (
            <AlertBanner alarms={alarms} settings={state.settings} onAcknowledge={actions.acknowledgeBag}
              live={state.source !== 'SIMULATED'} />
          )}
          <div key={route} className="ds-page">
            {route === 'overview' && <Overview onNavigate={navigate} />}
            {route === 'live' && <LiveMonitoring />}
            {route === 'history' && <AlertHistory onNavigate={navigate} />}
            {route === 'settings' && <SettingsPage />}
            {route === 'not-found' && <NotFound onNavigate={navigate} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MonitorProvider>
      <Shell />
    </MonitorProvider>
  );
}
