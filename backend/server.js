require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const os = require('os');
const pool = require('./db');

// Import Background Services
const { initMQTT } = require('./edge/mqttService');
const { initMLPipeline } = require('./services/mlPipeline');
const connectivityService = require('./edge/connectivityService');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const historyRoutes = require('./routes/historyRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const thresholdsRoutes = require('./routes/thresholdsRoutes');
const actuatorRoutes = require('./routes/actuatorRoutes');
const profileRoutes = require('./routes/profileRoutes');
const chartsRoutes = require('./routes/chartsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const boxesRoutes = require('./routes/boxesRoutes');
const systemRoutes = require('./routes/systemRoutes');
const researchRoutes = require('./routes/researchRoutes');
const experimentRoutes = require('./routes/experimentRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const experimentService = require('./services/experimentService');
const metricsService = require('./services/metricsService');

const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO CONFIG
========================= */
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Attach io to Express app instance to be accessible in routes
app.set('io', io);

/* =========================
   MIDDLEWARE
========================= */
app.use(helmet());
app.use(cors());
app.use(express.json());

/* =========================
   INITIALIZE SERVICES
========================= */
initMQTT(io, pool);
initMLPipeline(io, pool);
connectivityService.init(io);
experimentService.init(); // Load active experiment
metricsService.start(); // Start 5s metric gathering
require('./research/datasetManager').init(); // Initialize Dataset Manager

const syncWorker = require('./edge/syncWorker');
syncWorker.start();

/* =========================
   REGISTER ROUTES
========================= */
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/thresholds', thresholdsRoutes);
app.use('/api/actuators', actuatorRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/tenants', tenantRoutes);
app.use('/api/boxes', boxesRoutes);
app.use('/api/research/experiments', experimentRoutes);
app.use('/api/research/simulator', simulatorRoutes);
app.use('/api/research/metrics', metricsRoutes);
app.use('/api/research/export', exportRoutes);
app.use('/api/research', researchRoutes);
app.use('/api', systemRoutes); // Register /api/health and /api/system/connectivity

/* =========================
   SOCKET CONNECTION LOG
========================= */
io.on('connection', (socket) => {
    console.log(`📡 Klien terhubung: ${socket.id}`);

    // --- KODE MODIFIKASI: PING-PONG HANDLER ---
    socket.on('ping_latency', (data) => {
        // Pantulkan kembali payload secara langsung (berisi client_time)
        socket.emit('pong_latency', data);
    });
    // ------------------------------------------

    // WS Latency Tracking
    socket.on('latency_pong', (data) => {
        // data contains: server_send_at, browser_receive_at, browser_render_at
        if (data && data.server_send_at && data.browser_receive_at) {
            const now = Date.now();
            const broadcast_latency_ms = data.browser_receive_at - data.server_send_at;
            const render_latency_ms = data.browser_render_at ? (data.browser_render_at - data.browser_receive_at) : 0;
            const e2e_latency_ms = (data.browser_render_at || data.browser_receive_at) - data.server_send_at;
            
            metricsService.record('ws_latency_ms', e2e_latency_ms); // Average
            metricsService.record('ws_packets', {
                server_send_at: data.server_send_at,
                browser_receive_at: data.browser_receive_at,
                browser_render_at: data.browser_render_at || data.browser_receive_at,
                broadcast_latency_ms,
                render_latency_ms,
                e2e_latency_ms
            });
        }
    });

    // WebRTC Latency Tracking
    socket.on('webrtc_latency_pong', (data) => {
        if (data && data.capture_time && data.display_time) {
            const e2e_latency = data.display_time - data.capture_time;
            metricsService.record('webrtc_latency_ms', e2e_latency);
            metricsService.record('webrtc_packets', {
                ...data,
                latency_ms: e2e_latency,
                fps: data.fps || 0,
                bitrate: data.bitrate || 0,
                jitter: data.jitter || 0
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ Klien terputus: ${socket.id}`);
    });
});

// Ping interval for WS latency
setInterval(() => {
    io.emit('latency_ping', { server_send_at: Date.now() });
}, 2000);

/* =========================
   START SERVER & IP DETECTION
========================= */
const PORT = process.env.PORT || 5000;
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n🚀 Server Backend sudah aktif!`);
    console.log(`-----------------------------------------`);
    console.log(`🏠 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${localIP}:${PORT}`);
    console.log(`-----------------------------------------\n`);
});