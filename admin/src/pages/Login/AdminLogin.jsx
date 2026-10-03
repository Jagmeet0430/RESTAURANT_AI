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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate("/dashboard");
      } else {
        setError(result.message || "Login failed");
      }
    } catch {
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
            RestaurantAI
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
              onChange={(event) => setEmail(event.target.value)}
              margin="normal"
              autoComplete="username"
              required
              disabled={loading}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              margin="normal"
              autoComplete="current-password"
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
        </Paper>
      </Box>
    </Container>
  );
}

export default AdminLogin;
