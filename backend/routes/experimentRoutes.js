const express = require('express');
const router = express.Router();
const pool = require('../db');
const experimentManager = require('../research/experimentManager');

// 1. GET all experiments
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM experiment_sessions ORDER BY created_at DESC`);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching experiments:", err);
        res.status(500).json({ error: "Failed to fetch experiments" });
    }
});

// 2. POST create experiment
router.post('/', async (req, res) => {
    try {
        const id = await experimentManager.createExperiment(req.body);
        res.status(201).json({ id, message: "Experiment created successfully" });
    } catch (err) {
        console.error("Error creating experiment:", err);
        res.status(500).json({ error: "Failed to create experiment" });
    }
});

// 3. POST start experiment
router.post('/:id/start', async (req, res) => {
    const { id } = req.params;
    try {
        await experimentManager.startExperiment(id);
        res.status(200).json({ message: "Experiment started" });
    } catch (err) {
        console.error("Error starting experiment:", err);
        res.status(500).json({ error: err.message || "Failed to start experiment" });
    }
});

// 4. POST pause experiment
router.post('/:id/pause', async (req, res) => {
    const { id } = req.params;
    try {
        await experimentManager.pauseExperiment(id);
        res.status(200).json({ message: "Experiment paused" });
    } catch (err) {
        console.error("Error pausing experiment:", err);
        res.status(500).json({ error: "Failed to pause experiment" });
    }
});

// 5. POST resume experiment
router.post('/:id/resume', async (req, res) => {
    const { id } = req.params;
    try {
        await experimentManager.resumeExperiment(id);
        res.status(200).json({ message: "Experiment resumed" });
    } catch (err) {
        console.error("Error resuming experiment:", err);
        res.status(500).json({ error: "Failed to resume experiment" });
    }
});

const publicationService = require('../research/publicationService');

// 6. POST finish experiment
router.post('/:id/finish', async (req, res) => {
    const { id } = req.params;
    try {
        const metrics = await experimentManager.finishExperiment(id);
        res.status(200).json({ message: "Experiment finished", metrics });
    } catch (err) {
        console.error("Error finishing experiment:", err);
        res.status(500).json({ error: "Failed to finish experiment" });
    }
});

// 6b. GET publication report
router.get('/:id/publication', async (req, res) => {
    const { id } = req.params;
    try {
        const report = await publicationService.generateReport(id);
        res.status(200).json(report);
    } catch (err) {
        console.error("Error generating publication report:", err);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

// 7. POST archive experiment
router.post('/:id/archive', async (req, res) => {
    const { id } = req.params;
    try {
        await experimentManager.archiveExperiment(id);
        res.status(200).json({ message: "Experiment archived" });
    } catch (err) {
        console.error("Error archiving experiment:", err);
        res.status(500).json({ error: "Failed to archive experiment" });
    }
});

// 8. DELETE experiment
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM experiment_sessions WHERE id = $1`, [id]);
        const localDb = require('../edge/localDatabase');
        if (localDb.db) {
            localDb.prepare(`DELETE FROM experiment_sessions WHERE id = ?`).run(id);
        }
        res.status(200).json({ message: "Experiment deleted" });
    } catch (err) {
        console.error("Error deleting experiment:", err);
        res.status(500).json({ error: "Failed to delete experiment" });
    }
});

module.exports = router;
