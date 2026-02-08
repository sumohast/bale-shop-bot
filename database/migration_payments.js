const mysql = require("mysql2/promise");
require("dotenv").config();

async function addPaymentsTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log("🔗 اتصال به MySQL برقرار شد");

    // ایجاد جدول payments (ساده - فقط برای فیش واریزی)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(15, 0) NOT NULL,
        status ENUM('pending', 'pending_verification', 'verified', 'rejected') DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'manual',
        receipt_image VARCHAR(500),
        verified_by INT,
        verified_at TIMESTAMP NULL,
        admin_notes TEXT,
        paid_at TIMESTAMP NULL,
        submitted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order (order_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ جدول payments ایجاد شد");

    await connection.end();
    console.log("\n✅ Migration با موفقیت انجام شد!");
    console.log("💡 حالا می‌توانید ربات را راه‌اندازی کنید");

  } catch (error) {
    console.error("❌ خطا در Migration:", error.message);
    process.exit(1);
  }
}

addPaymentsTable();