const db = require("../config/db");

exports.getProjectBOM = async (req, res) => {
  try {
    const { project_id } = req.params;

    // 1️⃣ Get project
    const [[project]] = await db.query(
      "SELECT product_id FROM projects WHERE id = ?",
      [project_id]
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // 2️⃣ Get BOM
    const [[bom]] = await db.query(
      "SELECT id FROM boms WHERE product_id = ? LIMIT 1",
      [project.product_id]
    );

    if (!bom) {
      return res.json({ success: true, data: [] });
    }

    // 3️⃣ Remove deleted BOM items
    await db.query(
      `DELETE FROM project_bom_items
       WHERE project_id = ?
       AND item_id NOT IN (
         SELECT item_id FROM bom_items WHERE bom_id = ?
       )`,
      [project_id, bom.id]
    );

    // 4️⃣ Get BOM items
    const [bomItems] = await db.query(
      `SELECT 
          bi.item_id,
          bi.quantity AS per_unit_qty,
          im.cost AS unit_cost,
          im.base_price
       FROM bom_items bi
       JOIN items_master im ON im.id = bi.item_id
       WHERE bi.bom_id = ?`,
      [bom.id]
    );

    // 5️⃣ Existing project items
    const [projectItems] = await db.query(
      "SELECT item_id FROM project_bom_items WHERE project_id = ?",
      [project_id]
    );

    const projectItemIds = projectItems.map(i => i.item_id);

    // 6️⃣ Insert missing items
    for (let item of bomItems) {
      if (!projectItemIds.includes(item.item_id)) {
        await db.query(
          `INSERT INTO project_bom_items 
          (project_id, item_id, per_unit_qty, quantity, item_price, unit_cost,production_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            project_id,
            item.item_id,
            item.per_unit_qty || 0, // ✅ correct
            0,                      // ✅ always start from 0
            item.base_price || 0,
            item.unit_cost || 0,
            0
          ]
        );
      }
    }

  

    // 8️⃣ Fix unit_cost if missing
    await db.query(
      `UPDATE project_bom_items pbi
       JOIN items_master im ON im.id = pbi.item_id
       SET pbi.unit_cost = im.cost
       WHERE pbi.project_id = ?
       AND (pbi.unit_cost IS NULL OR pbi.unit_cost = 0)`,
      [project_id]
    );

    // 9️⃣ Final data
    const [finalData] = await db.query(
      `SELECT 
          pbi.id,
          pbi.project_id,
          pbi.item_id,
          pbi.per_unit_qty,
          pbi.quantity,
          pbi.item_price,
          COALESCE(pbi.unit_cost, im.cost, 0) AS unit_cost,
          COALESCE(pbi.production_cost,0) AS production_cost,
          pbi.customer_part_no,
          pbi.is_selected,
          im.item_name,
          im.cost AS master_cost,
          im.base_price,
          im.hsn_code
       FROM project_bom_items pbi
       JOIN items_master im ON im.id = pbi.item_id
       WHERE pbi.project_id = ?`,
      [project_id]
    );

    res.json({ success: true, data: finalData });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error fetching project BOM",
    });
  }
};
// Returns BOM items for a project (without Express res)
exports.getProjectBOMData = async (project_id) => {
  // 1️⃣ Get project
  const [[project]] = await db.query(
    "SELECT product_id FROM projects WHERE id = ?",
    [project_id]
  );

  if (!project) return null;

  // 2️⃣ Get BOM header
  const [[bom]] = await db.query(
    "SELECT id FROM boms WHERE product_id = ? LIMIT 1",
    [project.product_id]
  );

  if (!bom) return [];

  // 3️⃣ Get product BOM items
  const [productItems] = await db.query(
    "SELECT item_id, quantity FROM bom_items WHERE bom_id = ?",
    [bom.id]
  );

  // 4️⃣ Get existing project BOM items
  const [projectItems] = await db.query(
    "SELECT item_id FROM project_bom_items WHERE project_id = ?",
    [project_id]
  );

  const projectItemIds = projectItems.map(i => i.item_id);

  // 5️⃣ Insert missing items
  for (let item of productItems) {
    if (!projectItemIds.includes(item.item_id)) {
      await db.query(
        `INSERT INTO project_bom_items 
          (project_id, item_id, per_unit_qty, quantity,customer_part_no)
         VALUES (?, ?, ?, 0,"")`,
        [project_id, item.item_id, item.quantity]
      );
    }
  }

  // 6️⃣ Return updated BOM with item names
  const [finalData] = await db.query(
    `SELECT 
        pbi.id,
        pbi.project_id,
        pbi.item_id,
        pbi.per_unit_qty,
        pbi.quantity,
        pbi.item_price,
        pbi.unit_cost,
        pbi.customer_part_no, 
        pbi.is_selected,
        im.item_name,
        im.base_price
      FROM project_bom_items pbi
      JOIN items_master im ON im.id = pbi.item_id
      WHERE pbi.project_id = ?`,
    [project_id]
  );

  return finalData;
};

/* UPDATE PROJECT BOM ITEM */
exports.updateProjectBOMItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, item_price, unit_cost, production_cost } = req.body;

    await db.query(
      "UPDATE project_bom_items SET quantity = ?, item_price = ?, unit_cost = ?, production_cost = ? WHERE id = ?",
      [quantity, item_price || 0, unit_cost || 0, production_cost || 0, id]
    );

    res.json({ success: true, message: "Project BOM updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};
exports.saveProjectBOM = async (req, res) => {
  try {
    const { project_id, items } = req.body;

    for (let item of items) {
      // Ensure per_unit_qty is valid, default 0 if missing or <=0
      let perUnitQty = Number(item.per_unit_qty);
      if (isNaN(perUnitQty)) perUnitQty = 0;

     await db.query(
  `UPDATE project_bom_items
   SET quantity = ?, 
       per_unit_qty = ?,
       is_selected = ?, 
       item_price = ?,

       unit_cost = CASE
         WHEN ? IS NOT NULL THEN ?
         ELSE unit_cost
       END,

       production_cost = CASE
         WHEN ? IS NOT NULL THEN ?
         ELSE production_cost
       END,

       customer_part_no = ?

   WHERE project_id = ? AND item_id = ?`,
  [
    item.quantity,
    perUnitQty,
    item.is_selected,
    item.item_price || 0,

    item.unit_cost,
    item.unit_cost,

    item.production_cost,
    item.production_cost,

    item.customer_part_no || "",
    project_id,
    item.item_id
  ]
);
    }

    res.json({ success: true, message: "BOM saved successfully" });
  } catch (error) {
    console.error("Save BOM error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};