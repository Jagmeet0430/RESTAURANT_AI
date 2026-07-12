import { Box, Paper, Stack, Typography } from "@mui/material";

function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        {badge && (
          <Typography
            sx={{
              mb: 0.5,
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              color: "#1976d2",
              letterSpacing: 0.6,
            }}
          >
            {badge}
          </Typography>
        )}
        <Typography variant="h4" sx={{ fontWeight: 900, color: "#111827" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  );
}

function StatCard({ label, value, helper, icon, accent = "#1976d2" }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: `${accent}14`,
            color: accent,
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>
            {value}
          </Typography>
          {helper && (
            <Typography sx={{ fontSize: 12, color: "#6b7280" }}>{helper}</Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function StatGrid({ children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
        gap: 2,
        mb: 3,
      }}
    >
      {children}
    </Box>
  );
}

function SectionCard({ title, subtitle, actions, children, sx }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        ...sx,
      }}
    >
      {(title || actions) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: children ? 2 : 0 }}
        >
          <Box>
            {title && <Typography sx={{ fontWeight: 900 }}>{title}</Typography>}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

export { PageHeader, SectionCard, StatCard, StatGrid };
