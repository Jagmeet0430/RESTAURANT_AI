// Menu model placeholder
// Database schema for menu items

export const menuModel = {
  table: "menu_items",
  columns: {
    id: "INT PRIMARY KEY AUTO_INCREMENT",
    name: "VARCHAR(255) NOT NULL",
    category: "VARCHAR(100) NOT NULL",
    price: "DECIMAL(10, 2) NOT NULL",
    description: "TEXT",
    veg_type: "ENUM('Veg', 'Non-Veg') NOT NULL",
    image_url: "VARCHAR(500)",
    available: "BOOLEAN DEFAULT true",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
};

// Order model
export const orderModel = {
  table: "orders",
  columns: {
    id: "INT PRIMARY KEY AUTO_INCREMENT",
    customer_id: "INT NOT NULL",
    items: "JSON NOT NULL",
    total_amount: "DECIMAL(10, 2) NOT NULL",
    status: "ENUM('Pending', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled')",
    payment_status: "ENUM('Pending', 'Paid', 'Failed')",
    special_instructions: "TEXT",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
};

// Customer model
export const customerModel = {
  table: "customers",
  columns: {
    id: "INT PRIMARY KEY AUTO_INCREMENT",
    name: "VARCHAR(255) NOT NULL",
    email: "VARCHAR(255) UNIQUE",
    phone: "VARCHAR(20) UNIQUE NOT NULL",
    address: "TEXT",
    city: "VARCHAR(100)",
    loyalty_points: "INT DEFAULT 0",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    updated_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
};
