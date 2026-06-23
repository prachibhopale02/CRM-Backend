const { body, param, validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const validateCreateBOM = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID required")
    .isInt(),

  body("items")
    .isArray({ min: 1 })
    .withMessage("Items array required"),

  body("items.*.item_id")
    .isInt()
    .withMessage("Item ID required"),

  body("items.*.quantity")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Quantity must be >= 0"),

  validate
];
const validateUpdatePerUnitQuantity = [
  param("bom_item_id").isInt().withMessage("BOM Item ID required"),
  body("quantity").isFloat({ min: 0 }).withMessage("Quantity must be >= 0"),
  validate
];
const validateDeleteBOM = [
  param("bom_id").isInt().withMessage("BOM ID required"),
  validate
];

module.exports = {
  validateCreateBOM,
  validateUpdatePerUnitQuantity,
  validateDeleteBOM
};