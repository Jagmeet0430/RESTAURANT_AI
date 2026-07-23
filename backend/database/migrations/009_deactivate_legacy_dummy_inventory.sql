UPDATE inventory
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE COALESCE(is_active, TRUE) = TRUE
  AND menu_id IS NULL
  AND NULLIF(TRIM(COALESCE(barcode, '')), '') IS NULL;
