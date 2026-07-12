// Utility functions

export const successResponse = (res, data, message = "Success", statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (res, message = "Error", statusCode = 500, data = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(data && { data }),
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
