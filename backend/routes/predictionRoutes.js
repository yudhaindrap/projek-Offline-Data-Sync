const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth');
const { getLatestPredictions } = require('../services/dataService');

const pool = require('../db');


/* =========================================================
   GET ALL PREDICTIONS
========================================================= */
router.get('/all', verifyToken, async (req, res) => {

    try {

        /* ================================================
           GET BOXES BASED ON USER ROLE
        ================================================ */

        let boxesResult;

        // ADMIN
        if (req.user.role === 'admin') {

            boxesResult = await pool.query(
                `
                SELECT id
                FROM boxes
                ORDER BY id ASC
                `
            );

        }

        // OPERATOR
        else {

            boxesResult = await pool.query(
                `
                SELECT id
                FROM boxes
                WHERE tenant_id = $1
                ORDER BY id ASC
                `,
                [req.user.tenant_id]
            );

        }

        const allowedBoxIds =
            boxesResult.rows.map(
                b => b.id
            );

        /* ================================================
           GET ALL PREDICTIONS
        ================================================ */

        const rows =
            await getLatestPredictions();

        /* ================================================
           FILTER ONLY OWNED BOXES
        ================================================ */

        const filtered =
            rows.filter(
                row =>
                    allowedBoxIds.includes(
                        row.box_id
                    )
            );

        /* ================================================
           FORMAT RESPONSE
        ================================================ */

        const result = filtered.map(row => {

            const counts =
                row.detection_counts || {};

            return {

                boxId:
                    row.box_id,

                floor:
                    row.box_id,

                input:
                    `Suhu ${row.latest_air_temp}°C, RH ${row.latest_air_humidity}%, Media ${row.latest_media_humidity}%`,

                dist:
                    `${counts.adult_larva || 0} Adult, ${counts.prepupa || 0} Prepupa`,

                days:
                    row.estimated_days,

                progress:
                    Math.max(
                        0,
                        Math.min(
                            100,
                            100 - (row.estimated_days * 3)
                        )
                    ),

                status:
                    row.estimated_days <= 7
                        ? "warning"
                        : "safe",

                date:
                    new Date(
                        Date.now() +
                        row.estimated_days * 86400000
                    ).toLocaleDateString(
                        'id-ID',
                        {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        }
                    )

            };

        });

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;