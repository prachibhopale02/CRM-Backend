const { body, validationResult } = require("express-validator");

/* =========================
   COMMON VALIDATION CHECK
========================= */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array()
    });
  }
  next();
};

/* =========================
   CREATE PROJECT VALIDATION
========================= */
const validateCreateProject = [

  body("project_no")
    .optional()
    .isString()
    .withMessage("Project number must be a string"),

  body("project_title")
    .notEmpty()
    .withMessage("Project title required"),

  body("customer_id")
    .isInt()
    .withMessage("Customer ID must be integer"),

  body("product_id")
    .isInt()
    .withMessage("Product ID must be integer"),

  body("order_quantity")
    .isFloat({ gt: 0 })
    .withMessage("Order quantity must be greater than 0"),

  body("order_month")
    .notEmpty()
    .withMessage("Order month required"),

  body("per_unit_value")
    .isFloat({ gt: 0 })
    .withMessage("Per unit value must be greater than 0"),

    body("project_remark")
  .optional()
  .isString()
  .withMessage("Project remark must be text"),

  // ... rest remains the same
  validate
];


/* =========================
   UPDATE PROJECT VALIDATION
========================= */
const validateUpdateProject = [

  
  body("project_title")
    .optional()
    .notEmpty(),

  body("customer_id")
    .optional()
    .isInt(),

  body("product_id")
    .optional()
    .isInt(),

  body("order_quantity")
    .optional()
    .isFloat({ gt: 0 }),

  body("order_month")
    .optional()
    .notEmpty(),

  body("per_unit_value")
    .optional()
    .isFloat({ gt: 0 }),

  body("is_order_confirmed")
    .optional()
    .isIn(["YES", "NO"]),

  body("remarks")
    .optional(),

    body("project_remark")
  .optional()
  .isString(),

  body("order_in_hand_qty")
    .optional()
    .isInt({ min: 0 }),

  body("delivery_months")
    .optional()
    .isInt({ min: 1 }),

  /* ===== FIXED FIELDS ===== */

  body("address")
    .optional({ checkFalsy: true })
    .isString(),

body("temperature")
  .optional()
  .isInt({ min: 0, max: 100 })
  .withMessage("Temperature must be between 0 and 100"),

  body("order_no")
    .optional({ checkFalsy: true })
    .isString(),

  body("order_date")
    .optional({ checkFalsy: true })
    .isISO8601(),


  validate
];


module.exports = {
  validateCreateProject,
  validateUpdateProject
};