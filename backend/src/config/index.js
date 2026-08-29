import dotenv from "dotenv";
dotenv.config();

export const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expire: process.env.JWT_EXPIRE || "7d",
};

export const fileConfig = {
  maxSize: Number(process.env.MAX_FILE_SIZE || 5242880),
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || "jpg,jpeg,png,gif,webp")
    .split(",")
    .map((extension) => extension.trim())
    .filter(Boolean),
  uploadDir: "uploads",
};
