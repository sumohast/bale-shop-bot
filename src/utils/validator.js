/**
 * تابع‌های اعتبارسنجی ورودی‌ها
 */

class Validator {
  /**
   * اعتبارسنجی شماره تلفن ایرانی
   */
  static isValidPhone(phone) {
    const phoneRegex = /^(\+98|0)?9\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * اعتبارسنجی کد پستی ایرانی
   */
  static isValidPostalCode(postalCode) {
    const postalRegex = /^\d{10}$/;
    return postalRegex.test(postalCode);
  }

  /**
   * اعتبارسنجی نام (حداقل 2 کاراکتر، فقط حروف و فاصله)
   */
  static isValidName(name) {
    if (!name || name.trim().length < 2) return false;
    const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]{2,}$/;
    return nameRegex.test(name);
  }

  /**
   * اعتبارسنجی آدرس (حداقل 10 کاراکتر)
   */
  static isValidAddress(address) {
    return address && address.trim().length >= 10;
  }

  /**
   * اعتبارسنجی قیمت (عدد مثبت)
   */
  static isValidPrice(price) {
    return !isNaN(price) && parseFloat(price) > 0;
  }

  /**
   * اعتبارسنجی تعداد (عدد صحیح مثبت)
   */
  static isValidQuantity(quantity) {
    return Number.isInteger(quantity) && quantity > 0;
  }

  /**
   * اعتبارسنجی کد تخفیف (فقط حروف و اعداد، 3-20 کاراکتر)
   */
  static isValidDiscountCode(code) {
    const codeRegex = /^[A-Z0-9]{3,20}$/;
    return codeRegex.test(code);
  }

  /**
   * پاکسازی متن از کاراکترهای خطرناک
   */
  static sanitizeText(text) {
    if (!text) return "";
    return text
      .replace(/[<>]/g, "")
      .trim()
      .substring(0, 1000); // محدودیت طول
  }

  /**
   * فرمت کردن شماره تلفن
   */
  static formatPhone(phone) {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("98")) {
      return "0" + cleaned.substring(2);
    }
    return cleaned.startsWith("0") ? cleaned : "0" + cleaned;
  }
}

module.exports = Validator;
