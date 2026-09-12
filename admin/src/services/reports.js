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

export const exportAllReports = async () => {
  const resp = await apiClient.get('/reports/all/export', { responseType: 'blob' });
  downloadBlob(resp.data, 'restaurantai_all_reports.pdf');
};

export const exportAllSales = async () => {
  const resp = await apiClient.get('/reports/sales/all/export', { responseType: 'blob' });
  downloadBlob(resp.data, 'restaurantai_all_sales.pdf');
};

export const getSalesReport = async () => {
  const response = await apiClient.get('/reports/sales');
  return response.data;
};

export const getEndOfDayReport = async () => {
  const response = await apiClient.get('/reports/end-of-day');
  return response.data;
};

export default { exportSales, exportInventory, exportCustomers, exportAllReports, exportAllSales, getSalesReport, getEndOfDayReport };
