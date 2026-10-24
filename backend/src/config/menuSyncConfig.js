import { cloudSyncConfig, syncError } from './cloudSyncConfig.js';

export const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
export function menuSyncConfig(env = process.env, { cloud = false } = {}) {
  if (String(env.MENU_SYNC_ENABLED).toLowerCase() !== 'true') return { enabled: false };
  const restaurantId = env.MENU_SYNC_RESTAURANT_ID;
  const sourceId = env.MENU_SYNC_SOURCE_ID;
  if (!isUuid(restaurantId) || !isUuid(sourceId)) throw syncError('SYNC_MENU_IDENTITY_CONFIG', 503);
  return { enabled: true, restaurantId, sourceId,
    ...(cloud ? {} : cloudSyncConfig({ ...env, CLOUD_SYNC_ENABLED: 'true' })) };
}
