import apiClient from './api';

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportSales = async (format = 'pdf') => {
  const resp = await apiClient.get(`/reports/sales/export?format=${format}`, { responseType: 'blob' });
  downloadBlob(resp.data, `daily_sales.${format === 'excel' ? 'xlsx' : 'pdf'}`);
};

export const exportInventory = async (format = 'pdf') => {
  const resp = await apiClient.get(`/reports/inventory/export?format=${format}`, { responseType: 'blob' });
  downloadBlob(resp.data, `inventory.${format === 'excel' ? 'xlsx' : 'pdf'}`);
};

export const exportCustomers = async (format = 'excel') => {
  const resp = await apiClient.get(`/reports/customers/export?format=${format}`, { responseType: 'blob' });
  downloadBlob(resp.data, `customers.${format === 'excel' ? 'xlsx' : 'pdf'}`);
};

export default { exportSales, exportInventory, exportCustomers };
