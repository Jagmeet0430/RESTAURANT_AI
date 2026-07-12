import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const OCR_API_URL = process.env.OCR_API_URL || "http://127.0.0.1:8003";

export const checkOcrHealth = async (req, res) => {
  try {
    const response = await axios.get(`${OCR_API_URL}/health`);

    return res.status(200).json({
      success: true,
      message: "OCR service is running",
      data: response.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "OCR service is not available",
      error: error.message,
    });
  }
};

export const uploadMenuForOcr = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Menu image is required",
      });
    }

    const formData = new FormData();

    formData.append("file", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(
      `${OCR_API_URL}/upload-menu?save_to_database=false`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 180000,
      }
    );

    fs.unlink(req.file.path, () => {});

    return res.status(200).json({
      success: true,
      message: "Menu image digitized successfully",
      data: response.data,
    });
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(500).json({
      success: false,
      message: "Failed to digitize menu image",
      error: error.message,
      details: error.response?.data || null,
    });
  }
};

export const getDigitizedItems = async (req, res) => {
  try {
    const response = await axios.get(`${OCR_API_URL}/digitized-menu/items`);
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch digitized menu items",
      error: error.message,
    });
  }
};

export const getDigitizedCategories = async (req, res) => {
  try {
    const response = await axios.get(`${OCR_API_URL}/digitized-menu/categories`);
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch digitized categories",
      error: error.message,
    });
  }
};
