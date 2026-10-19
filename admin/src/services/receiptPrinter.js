import apiClient from './api';

export function newPrintRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export const receiptPrinter = {
  settings: async () => (await apiClient.get('/receipt-printer/settings')).data.data,
  save: async config => (await apiClient.put('/receipt-printer/settings', config)).data.data,
  preview: async (source, id) => (await apiClient.get(`/receipt-printer/preview/${encodeURIComponent(source)}/${encodeURIComponent(id)}`)).data.data,
  print: async (source, id, requestId) => (await apiClient.post(
    source === 'test' ? '/receipt-printer/test' : `/receipt-printer/print/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    { requestId }, { timeout: 45000 })).data.data,
};
