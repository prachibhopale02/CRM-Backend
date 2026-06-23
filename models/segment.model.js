const db = require("../config/db");

const Segment = {};

/* CREATE SEGMENT */
Segment.create = async (segment_name) => {
  const [result] = await db.execute(
    `INSERT INTO segments (segment_name) VALUES (?)`,
    [segment_name]
  );
  return result;
};

/* GET ALL SEGMENTS */
Segment.getAll = async () => {
  const [rows] = await db.execute(
    `SELECT * FROM segments ORDER BY id DESC`
  );
  return rows;
};

/* DELETE SEGMENT */
Segment.delete = async (id) => {
  const [result] = await db.execute(
    `DELETE FROM segments WHERE id = ?`,
    [id]
  );
  return result;
};

/* UPDATE SEGMENT */
Segment.update = async (id, segment_name) => {
  const [result] = await db.execute(
    `UPDATE segments SET segment_name = ? WHERE id = ?`,
    [segment_name, id]
  );
  return result;
};

/* FIND SEGMENT BY ID */
Segment.findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT * FROM segments WHERE id = ?`,
    [id]
  );
  return rows[0];
};

module.exports = Segment;