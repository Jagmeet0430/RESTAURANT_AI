import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import StoreIcon from "@mui/icons-material/Store";
import apiClient from "../../services/api";
import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";

function stockPercent(item) {
  const stock = Number(item.stock_quantity || 0);
  const min = Number(item.min_threshold || 0);
  if (!min) return 100;
  return Math.min(100, Math.round((stock / Math.max(min * 2, 1)) * 100));
}

function Inventory() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiClient.get("/inventory"), apiClient.get("/inventory/suppliers")])
      .then(([inventoryResponse, supplierResponse]) => {
        if (!mounted) return;
        setItems(inventoryResponse.data.data || []);
        setSuppliers(supplierResponse.data.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const lowStockItems = useMemo(
    () => items.filter((item) => Number(item.stock_quantity || 0) <= Number(item.min_threshold || 0)),
    [items]
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Stock Control"
        title="Inventory"
        subtitle="Track ingredients, spot low stock before service, and know which supplier to call."
      />

      {loading ? (
        <SectionCard>
          <CircularProgress size={24} />
        </SectionCard>
      ) : (
        <>
          <StatGrid>
            <StatCard
              label="Ingredients"
              value={items.length}
              helper="Total tracked stock items"
              icon={<Inventory2Icon />}
              accent="#1976d2"
            />
            <StatCard
              label="Low stock"
              value={lowStockItems.length}
              helper="Needs attention"
              icon={<ReportProblemIcon />}
              accent="#dc2626"
            />
            <StatCard
              label="Suppliers"
              value={suppliers.length}
              helper="Available vendor contacts"
              icon={<StoreIcon />}
              accent="#059669"
            />
          </StatGrid>

          {lowStockItems.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {lowStockItems.length} item{lowStockItems.length === 1 ? "" : "s"} need restocking before busy hours.
            </Alert>
          )}

          <SectionCard title="Stock Overview" subtitle="Simple view of quantity, minimum level, expiry, and supplier.">
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell sx={{ fontWeight: 900 }}>Ingredient</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Stock</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Health</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Expiry</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                        <Typography color="text.secondary">No inventory items found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const isLow = Number(item.stock_quantity || 0) <= Number(item.min_threshold || 0);
                      return (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{item.ingredient}</TableCell>
                          <TableCell>
                            {item.stock_quantity} {item.unit || ""}
                            <Typography variant="caption" color="text.secondary" display="block">
                              Min {item.min_threshold}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <LinearProgress
                              variant="determinate"
                              value={stockPercent(item)}
                              color={isLow ? "error" : "success"}
                              sx={{ height: 8, borderRadius: 99 }}
                            />
                          </TableCell>
                          <TableCell>{item.expiry_date || "-"}</TableCell>
                          <TableCell>{item.supplier || "-"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={isLow ? "Restock" : "Healthy"}
                              color={isLow ? "error" : "success"}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </>
      )}
    </Box>
  );
}

export default Inventory;
