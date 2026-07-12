import React from "react";
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: "center",
          }}
        >
          <Typography
            variant="h2"
            color="error"
            gutterBottom
          >
            403
          </Typography>

          <Typography variant="h5" gutterBottom>
            Unauthorized Access
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            You don't have permission to access this resource.
          </Typography>

          <Button
            variant="contained"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}

export default Unauthorized;