import { SettingsForm } from '../components/SettingsForm';
import { useMonitorContext } from '../state/MonitorContext';

export function SettingsPage() {
  const { state, actions } = useMonitorContext();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
      <div className="ds-card max-w-3xl p-5">
        <SettingsForm settings={state.settings} onSave={actions.updateSettings} />
      </div>
    </div>
  );
}
