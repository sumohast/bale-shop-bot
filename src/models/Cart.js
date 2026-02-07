const db = require("../config/database");
const logger = require("../utils/logger");

class Cart {
  static async add(userId, productId, quantity = 1) {
    try {
      const [existing] = await db.query(
        "SELECT * FROM cart WHERE user_id = ? AND product_id = ?",
        [userId, productId]
      );

      if (existing.length > 0) {
        await db.query(
          "UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?",
          [quantity, userId, productId]
        );
      } else {
        await db.query(
          "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)",
          [userId, productId, quantity]
        );
      }

      logger.info(`محصول ${productId} به سبد کاربر ${userId} اضافه شد`);
    } catch (error) {
      logger.error(`خطا در add to cart: ${error.message}`);
      throw error;
    }
  }

  static async remove(userId, productId) {
    try {
      await db.query(
        "DELETE FROM cart WHERE user_id = ? AND product_id = ?",
        [userId, productId]
      );
      logger.info(`محصول ${productId} از سبد کاربر ${userId} حذف شد`);
    } catch (error) {
      logger.error(`خطا در remove from cart: ${error.message}`);
      throw error;
    }
  }

  static async decrease(userId, productId, quantity = 1) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM cart WHERE user_id = ? AND product_id = ?",
        [userId, productId]
      );

      if (rows.length === 0) return;

      if (rows[0].quantity <= quantity) {
        await this.remove(userId, productId);
      } else {
        await db.query(
          "UPDATE cart SET quantity = quantity - ? WHERE user_id = ? AND product_id = ?",
          [quantity, userId, productId]
        );
      }
    } catch (error) {
      logger.error(`خطا در decrease cart: ${error.message}`);
      throw error;
    }
  }

  static async updateQuantity(userId, productId, quantity) {
    try {
      if (quantity <= 0) {
        await this.remove(userId, productId);
      } else {
        await db.query(
          "UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?",
          [quantity, userId, productId]
        );
      }
    } catch (error) {
      logger.error(`خطا در updateQuantity: ${error.message}`);
      throw error;
    }
  }

  static async get(userId) {
    try {
      const [rows] = await db.query(
        `SELECT 
          products.id as product_id,
          products.name,
          products.price,
          products.discount_price,
          products.stock,
          products.image_url,
          cart.quantity
         FROM cart
         JOIN products ON cart.product_id = products.id
         WHERE cart.user_id = ? AND products.is_active = 1`,
        [userId]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در get cart: ${error.message}`);
      throw error;
    }
  }

  static async clear(userId) {
    try {
      await db.query("DELETE FROM cart WHERE user_id = ?", [userId]);
      logger.info(`سبد خرید کاربر ${userId} پاک شد`);
    } catch (error) {
      logger.error(`خطا در clear cart: ${error.message}`);
      throw error;
    }
  }

  static async getTotal(userId) {
    try {
      const items = await this.get(userId);
      let total = 0;
      let count = 0;

      items.forEach((item) => {
        const price = item.discount_price || item.price;
        total += price * item.quantity;
        count += item.quantity;
      });

      return { total, count, items };
    } catch (error) {
      logger.error(`خطا در getTotal cart: ${error.message}`);
      throw error;
    }
  }

  static async count(userId) {
    try {
      const [rows] = await db.query(
        "SELECT SUM(quantity) as count FROM cart WHERE user_id = ?",
        [userId]
      );
      return rows[0].count || 0;
    } catch (error) {
      logger.error(`خطا در count cart: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Cart;
