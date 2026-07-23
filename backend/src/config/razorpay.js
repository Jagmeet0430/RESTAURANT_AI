import Razorpay from "razorpay";

let razorpayClient = null;

export function assertRazorpayConfig() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay environment variables are missing");
    error.statusCode = 503;
    throw error;
  }
}

export function getRazorpayClient() {
  assertRazorpayConfig();

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayClient;
}
