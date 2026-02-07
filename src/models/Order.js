const db = require("../config/database");
const logger = require("../utils/logger");
const Helper = require("../utils/helper");
const Product = require("./Product");

class Order {
  static async create(userId, orderData) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // محاسبه قیمت‌ها
      const subtotal = orderData.total_price;
      const discount = orderData.discount_amount || 0;
      const tax = Helper.calculateTax(subtotal - discount, orderData.tax_percentage || 9);
      const finalPrice = Helper.calculateFinalPrice(subtotal, discount, orderData.tax_percentage || 9);

      // ایجاد سفارش
      const [result] = await connection.query(
        `INSERT INTO orders 
         (user_id, full_name, phone, address, postal_code, total_price, discount_amount, tax_amount, final_price, status, payment_status, tracking_code, customer_notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          orderData.full_name,
          orderData.phone,
          orderData.address,
          orderData.postal_code || null,
          subtotal,
          discount,
          tax,
          finalPrice,
          'pending',
          'unpaid',
          Helper.generateTrackingCode(),
          orderData.customer_notes || null
        ]
      );

      const orderId = result.insertId;

      // درج آیتم‌های سفارش
      for (const item of orderData.items) {
        const product = await Product.findById(item.product_id);
        
        if (!product) {
          throw new Error(`محصول ${item.product_id} یافت نشد`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`موجودی محصول ${product.name} کافی نیست`);
        }

        await connection.query(
          "INSERT INTO order_items (order_id, product_id, product_name, quantity, price, discount_price) VALUES (?, ?, ?, ?, ?, ?)",
          [orderId, item.product_id, product.name, item.quantity, product.price, product.discount_price]
        );

        // کاهش موجودی و افزایش فروش
        await connection.query(
          "UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ?",
          [item.quantity, item.quantity, item.product_id]
        );
      }

      await connection.commit();
      logger.info(`سفارش جدید ثبت شد: ${orderId}`);
      
      return orderId;
    } catch (error) {
      await connection.rollback();
      logger.error(`خطا در create order: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById order: ${error.message}`);
      throw error;
    }
  }

  static async findByUser(userId, limit = 50) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [userId, limit]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در findByUser orders: ${error.message}`);
      throw error;
    }
  }

  static async getItems(orderId) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [orderId]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getItems: ${error.message}`);
      throw error;
    }
  }

  static async updateStatus(orderId, status) {
    try {
      await db.query("UPDATE orders SET status = ? WHERE id = ?", [
        status,
        orderId,
      ]);
      logger.info(`وضعیت سفارش ${orderId} به ${status} تغییر کرد`);
    } catch (error) {
      logger.error(`خطا در updateStatus: ${error.message}`);
      throw error;
    }
  }

  static async updatePaymentStatus(orderId, paymentStatus) {
    try {
      await db.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
        paymentStatus,
        orderId,
      ]);
      logger.info(`وضعیت پرداخت سفارش ${orderId} به ${paymentStatus} تغییر کرد`);
    } catch (error) {
      logger.error(`خطا در updatePaymentStatus: ${error.message}`);
      throw error;
    }
  }

  static async cancel(orderId, reason = null) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // دریافت آیتم‌ها
      const [items] = await connection.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [orderId]
      );

      // بازگرداندن موجودی
      for (const item of items) {
        await connection.query(
          "UPDATE products SET stock = stock + ?, sold_count = sold_count - ? WHERE id = ?",
          [item.quantity, item.quantity, item.product_id]
        );
      }

      // تغییر وضعیت سفارش
      await connection.query(
        "UPDATE orders SET status = 'cancelled', admin_notes = ? WHERE id = ?",
        [reason, orderId]
      );

      await connection.commit();
      logger.info(`سفارش ${orderId} لغو شد`);
    } catch (error) {
      await connection.rollback();
      logger.error(`خطا در cancel order: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAll(filters = {}, limit = 100, offset = 0) {
    try {
      let query = "SELECT * FROM orders WHERE 1=1";
      const params = [];

      if (filters.status) {
        query += " AND status = ?";
        params.push(filters.status);
      }
      if (filters.payment_status) {
        query += " AND payment_status = ?";
        params.push(filters.payment_status);
      }
      if (filters.from_date) {
        query += " AND created_at >= ?";
        params.push(filters.from_date);
      }
      if (filters.to_date) {
        query += " AND created_at <= ?";
        params.push(filters.to_date);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`خطا در getAll orders: ${error.message}`);
      throw error;
    }
  }

  static async getStats(fromDate = null, toDate = null) {
    try {
      let dateFilter = "";
      const params = [];

      if (fromDate && toDate) {
        dateFilter = " AND created_at BETWEEN ? AND ?";
        params.push(fromDate, toDate);
      }

      const [total] = await db.query(
        `SELECT COUNT(*) as count, SUM(final_price) as revenue FROM orders WHERE 1=1${dateFilter}`,
        params
      );

      const [pending] = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'${dateFilter}`,
        params
      );

      const [completed] = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'${dateFilter}`,
        params
      );

      const [cancelled] = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled'${dateFilter}`,
        params
      );

      return {
        total: total[0].count,
        revenue: total[0].revenue || 0,
        pending: pending[0].count,
        completed: completed[0].count,
        cancelled: cancelled[0].count,
      };
    } catch (error) {
      logger.error(`خطا در getStats orders: ${error.message}`);
      throw error;
    }
  }
  static async findByTrackingCode(trackingCode) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM orders WHERE tracking_code = ?",
        [trackingCode]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findByTrackingCode: ${error.message}`);
      throw error;
    }
  }

  static async getItems(orderId) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [orderId]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getItems: ${error.message}`);
      throw error;
    }
  }
  static async getDiscountCode(orderId) {
    try {
      const [rows] = await db.query(`
        SELECT dc.code 
        FROM discount_usage du
        JOIN discount_codes dc ON du.discount_code_id = dc.id
        WHERE du.order_id = ?
        LIMIT 1
      `, [orderId]);
      return rows.length > 0 ? rows[0].code : null;
    } catch (error) {
      logger.error(`خطا در getDiscountCode: ${error.message}`);
      return null;
    }
  }
}

module.exports = Order;
