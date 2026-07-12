const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth');
const pool = require('../db');

const { mqttClient } = require('../edge/mqttService');


/* =========================================================
   TOGGLE ACTUATOR
========================================================= */
router.post('/toggle', verifyToken, async (req, res) => {

    try {

        const {
            box_id,
            actuator,
            state
        } = req.body;

        if (!box_id) {
            return res.status(400).json({
                message: 'box_id wajib diisi.'
            });
        }

        if (!actuator) {
            return res.status(400).json({
                message: 'actuator wajib diisi.'
            });
        }

        /* =================================================
           VALIDASI AKSES BOX
        ================================================= */

        let boxCheck;

        // ADMIN → semua box
        if (req.user.role === 'admin') {

            boxCheck = await pool.query(
                'SELECT * FROM boxes WHERE id = $1',
                [box_id]
            );

        }

        // OPERATOR → hanya box miliknya
        else {

            boxCheck = await pool.query(
                `
                SELECT *
                FROM boxes
                WHERE id = $1
                AND tenant_id = $2
                `,
                [box_id, req.user.tenant_id]
            );

        }

        if (boxCheck.rows.length === 0) {

            return res.status(403).json({
                message: 'Tidak memiliki akses ke box ini.'
            });

        }

        /* =================================================
           MQTT PUBLISH
        ================================================= */

        const payload = JSON.stringify({
            box_id,
            actuator,
            state,
            source: 'web_manual',
            user_id: req.user.tenant_id || req.user.id,
            role: req.user.role
        });

        if (!mqttClient || !mqttClient.connected) {

            console.error(
                'MQTT Client not connected.'
            );

            return res.status(503).json({
                error: 'MQTT Broker disconnected.'
            });

        }

        mqttClient.publish(
            'maggot/kandang/kontrol',
            payload
        );

        console.log(
            `🎮 Manual Control Published: ${payload}`
        );

        res.json({
            message:
                `${actuator} ${state ? 'ON' : 'OFF'} berhasil dikirim.`,
            payload
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;