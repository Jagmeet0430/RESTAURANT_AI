import React, { useState } from "react";
import {
  Container,
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AdminLogin() {
  const [email, setEmail] = useState("admin@restaurantai.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    console.log("🚀 Login button clicked");

    e.preventDefault();

    console.log("Step 1: Button clicked");

    setError("");
    setLoading(true);

    try {
      console.log("Step 2: Calling login()");

      const result = await login(email, password);

      console.log("Step 3: Login result =", result);

      if (result.success) {
        console.log("Step 4: Navigating to dashboard");
        navigate("/dashboard");
      } else {
        console.log("Step 5: Login failed");
        setError(result.message || "Login failed");
      }
    } catch (err) {
      console.error("Step 6: Error =", err);
      setError("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
      sx={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
  }}
       
      >
        <Paper elevation={3} sx={{ p: 4, width: "100%" }}>
          <Typography variant="h3" align="center" gutterBottom>
            🍽️ RestaurantAI
          </Typography>

          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Admin Login
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              disabled={loading}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
            />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              type="submit"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Login"}
            </Button>
          </form>

          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ mt: 2 }}
          >
            Demo Credentials:
            <br />
            Email: admin@restaurantai.com
            <br />
            Password: (Set after first registration)
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default AdminLogin;