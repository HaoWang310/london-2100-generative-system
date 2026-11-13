// Basemap providers. The viewer asks a provider for a MapLibre style.
//
// Google Maps is reserved: when an API key is configured (never committed —
// injected at deploy time or typed by the user, and restricted by HTTP
// referrer in Google Cloud), a provider implementing the same interface will
// return a style backed by Google's Map Tiles API.

export const PROVIDERS = {
  openfreemap: {
    id: 'openfreemap',
    label: 'OpenStreetMap / OpenFreeMap',
    attribution: '© OpenStreetMap contributors · OpenFreeMap',
    // 'liberty' is the style google-map-live uses in production. The dark
    // monochrome look is applied after load by restyleDark() in palette.js,
    // so we don't depend on a separate dark style existing upstream.
    style() {
      return 'https://tiles.openfreemap.org/styles/liberty';
    }
  },
  google: {
    id: 'google',
    label: 'Google Maps (reserved)',
    available: () => false,
    style() {
      throw new Error('Google Maps provider is reserved for a later phase; configure an API key first.');
    }
  }
};

export const DEFAULT_PROVIDER = 'openfreemap';
