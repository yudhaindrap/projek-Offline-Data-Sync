const pool = require('../db');

class ExperimentService {
    constructor() {
        this.activeExperimentId = null;
    }

    async init() {
        try {
            const res = await pool.query(`SELECT id FROM experiment_sessions WHERE status = 'active' LIMIT 1`);
            if (res.rows.length > 0) {
                this.activeExperimentId = res.rows[0].id;
                console.log(`[ExperimentService] Loaded active experiment: ${this.activeExperimentId}`);
            } else {
                console.log(`[ExperimentService] No active experiment found.`);
            }
        } catch (err) {
            console.error(`[ExperimentService] Failed to load active experiment:`, err.message);
        }
    }

    getActiveExperimentId() {
        return this.activeExperimentId;
    }

    setActiveExperimentId(id) {
        this.activeExperimentId = id;
        console.log(`[ExperimentService] Active experiment set to: ${id}`);
    }

    clearActiveExperiment() {
        this.activeExperimentId = null;
        console.log(`[ExperimentService] Active experiment cleared.`);
    }
}

const experimentService = new ExperimentService();
module.exports = experimentService;
