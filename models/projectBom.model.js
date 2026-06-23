const db = require("../config/db");

const getProjectBOMData = async (projectId) => {
  const [rows] = await db.query(
    `SELECT 
        pbi.*, 
        im.item_name
     FROM project_bom_items pbi
     LEFT JOIN items_master im 
       ON pbi.item_id = im.id
     WHERE pbi.project_id = ?`,
    [projectId]
  );
  return rows;
};
module.exports = { getProjectBOMData };