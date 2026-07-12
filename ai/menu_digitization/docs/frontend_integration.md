# Frontend Integration - Menu Digitization AI

OCR API Base URL:
http://127.0.0.1:8001

Available Endpoints:

GET /health
POST /upload-menu
GET /digitized-menu/items
GET /digitized-menu/categories
GET /digitized-menu/summary

Upload Menu Image Form Data:
file: menu image
save_to_database: true

React Axios Example:

import axios from "axios";

const OCR_API_URL = "http://127.0.0.1:8001";

export const uploadMenuImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${OCR_API_URL}/upload-menu?save_to_database=true`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const getDigitizedMenuItems = async () => {
  const response = await axios.get(`${OCR_API_URL}/digitized-menu/items`);
  return response.data;
};

export const getDigitizedMenuCategories = async () => {
  const response = await axios.get(`${OCR_API_URL}/digitized-menu/categories`);
  return response.data;
};

export const getDigitizedMenuSummary = async () => {
  const response = await axios.get(`${OCR_API_URL}/digitized-menu/summary`);
  return response.data;
};

Required Running Servers:

Terminal 1:
OCR FastAPI
http://127.0.0.1:8001

Terminal 2:
RestaurantAI Admin React
http://localhost:5173

Integration Flow:

React Admin Panel
↓
Upload menu image
↓
FastAPI OCR Service
↓
Preprocessing + OCR + Parser + Correction
↓
PostgreSQL Database
↓
Admin Panel shows digitized menu items
