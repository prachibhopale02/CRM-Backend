const Segment = require("../models/segment.model");

/* CREATE SEGMENT */
exports.createSegment = async (req, res) => {
  try {
    const { segment_name } = req.body;
    if (!segment_name) return res.status(400).json({ message: "Segment name required" });

    const result = await Segment.create(segment_name);

    res.status(201).json({
      message: "Segment created successfully",
      segment_id: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* GET SEGMENTS */
exports.getSegments = async (req, res) => {
  try {
    const segments = await Segment.getAll();
    res.json(segments);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* DELETE SEGMENT */
exports.deleteSegment = async (req, res) => {
  try {
    await Segment.delete(req.params.id);
    res.json({ message: "Segment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* UPDATE SEGMENT */
exports.updateSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const { segment_name } = req.body;

    if (!segment_name) return res.status(400).json({ message: "Segment name required" });

    const segment = await Segment.findById(id);
    if (!segment) return res.status(404).json({ message: "Segment not found" });

    await Segment.update(id, segment_name);

    res.json({ message: "Segment updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};