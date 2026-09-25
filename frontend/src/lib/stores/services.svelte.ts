import { services, type ServiceInfo, type ServiceName, type ServiceStatus } from '$api/client';

type StatusMap = Partial<Record<ServiceName, ServiceStatus & { loading?: boolean }>>;

let _services = $state<ServiceInfo[]>([]);
let _statuses = $state<StatusMap>({});
let _loading = $state(false);
let _pollingInterval: ReturnType<typeof setInterval> | null = null;

export const servicesStore = {
  get list() { return _services; },
  get statuses() { return _statuses; },
  get loading() { return _loading; },

  async fetchList() {
    _loading = true;
    try {
      _services = await services.list();
    } finally {
      _loading = false;
    }
  },

  async fetchStatus(name: ServiceName) {
    _statuses[name] = { ...(_statuses[name] ?? {}), loading: true, online: false };
    try {
      const s = await services.status(name);
      _statuses[name] = { ...s, loading: false };
    } catch {
      _statuses[name] = { online: false, error: 'unreachable', loading: false };
    }
  },

  async refreshAllStatuses() {
    const list = _services.length ? _services : await services.list().catch(() => []);
    if (!_services.length && list.length) _services = list;
    await Promise.allSettled(list.map(s => servicesStore.fetchStatus(s.name as ServiceName)));
  },

  startPolling(intervalMs = 30_000) {
    servicesStore.refreshAllStatuses();
    _pollingInterval = setInterval(() => servicesStore.refreshAllStatuses(), intervalMs);
  },

  stopPolling() {
    if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
  }
};
