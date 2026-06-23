const express = require('express');
const router = express.Router();
const iofController = require('../controllers/iof.controller');


// ✅ FIRST: specific routes
router.get('/project/:project_id', iofController.getIOFByProjectId);

router.post('/send-email/:id', iofController.sendIOFEmail);

router.get("/email-approve/:id", iofController.emailApproveIOF);

router.get("/email-reject/:id", iofController.emailRejectIOF);

router.get("/reject/:id", iofController.renderRejectPage);

router.post("/reject/:id", iofController.submitRejectPage);

router.post("/approve/:id", iofController.approveIOF);

// generic routes ALWAYS LAST
router.post('/', iofController.createOrUpdateIOF);

router.get('/', iofController.getAllIOFs);

router.get('/:id', iofController.getIOFById);

router.delete('/:id', iofController.deleteIOF);
module.exports = router;