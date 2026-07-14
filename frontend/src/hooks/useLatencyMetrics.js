import { useEffect } from 'react';

/**
 * HOOK 1: Menghitung Latensi WebSocket (Ping-Pong)
 * @param {object} socket - Instance Socket.IO atau WebSocket client
 */
export function useWebSocketLatency(socket) {
    useEffect(() => {
        if (!socket) return;
        
        // --- KODE MODIFIKASI: MEKANISME PING-PONG LATENSI ---
        const pingInterval = setInterval(() => {
            // Emit ping ke server setiap 10 detik
            socket.emit('ping_latency', { client_time: Date.now() });
        }, 10000);

        const handlePong = (data) => {
            if (data && data.client_time) {
                // RTT (Round-Trip Time)
                const rtt = Date.now() - data.client_time;
                // Asumsi latensi 1 arah
                const oneWayLatency = rtt / 2;
                
                // Lempar hasil ke REST API secara asynchronous di background
                fetch('/api/metrics/websocket-latency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latency_ms: oneWayLatency })
                }).catch(err => console.error("Gagal POST metrik WS:", err));
            }
        };

        socket.on('pong_latency', handlePong);
        
        return () => {
            clearInterval(pingInterval);
            socket.off('pong_latency', handlePong);
        };
    }, [socket]);
}

/**
 * HOOK 2: Menghitung Latensi WebRTC (via getStats)
 * @param {RTCPeerConnection} peerConnection - Instance aktif dari RTCPeerConnection
 */
export function useWebRTCLatency(peerConnection) {
    useEffect(() => {
        if (!peerConnection) return;

        // Interval eksekusi setiap 10 detik sesuai instruksi
        const interval = setInterval(async () => {
            try {
                const stats = await peerConnection.getStats(null);
                stats.forEach(report => {
                    // Filter berdasarkan active candidate-pair
                    if (report.type === 'candidate-pair' && 
                       (report.state === 'succeeded' || report.state === 'in-progress')) {
                        
                        const rtt = report.currentRoundTripTime || report.roundTripTime;
                        if (rtt !== undefined) {
                            // rtt secara native berupa nilai detik. Ubah ke milidetik (* 1000)
                            const rtt_ms = rtt * 1000;
                            // Estimasi latensi 1-arah = RTT / 2
                            const one_way_latency_ms = rtt_ms / 2;

                            fetch('/api/metrics/latency', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'webrtc', latency_ms: one_way_latency_ms })
                            }).catch(err => console.error('Gagal mengirim metrik WebRTC:', err));
                        }
                    }
                });
            } catch (err) {
                console.error('Error pengukuran getStats WebRTC:', err);
            }
        }, 10000); 

        return () => clearInterval(interval);
    }, [peerConnection]);
}
