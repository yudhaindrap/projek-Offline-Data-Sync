import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useWebRTCLatency } from '../hooks/useLatencyMetrics';

const BACKEND_IP = "192.168.198.1"; // ⚠️ GANTI DENGAN IP LAPTOPMU

export default function CameraSender() {
  const localVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const socket = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Siap");

  // Mount latency background hook
  useWebRTCLatency(peerConnection.current);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const stopStream = () => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startStream = async () => {
    try {
      stopStream();
      setStatus("Menyiapkan Kamera HD...");

      socket.current = io(`http://${BACKEND_IP}:5002`);

      // --- PERUBAHAN DISINI: CONFIG HD ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Akses kamera diblokir oleh browser. Anda harus mengakses ini melalui HTTPS atau localhost. (Solusi cepat di HP Android: buka chrome://flags/#unsafely-treat-insecure-origin-as-secure lalu tambahkan http://192.168.1.19:3000 dan Enable)");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },  // Meminta lebar 1280px (HD)
          height: { ideal: 720 },  // Meminta tinggi 720px (HD)
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate && socket.current) {
          socket.current.emit("webrtc-candidate", event.candidate);
        }
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      
      // Kirim offer dan tentukan Room tempat kamera ini berada
      socket.current.emit("webrtc-offer", {
        sdp: offer.sdp,
        type: offer.type,
        room: "Ruang 2" // Identitas ruangan kamera ini (Hardcoded sementara)
      });

      setStatus("Streaming HD Aktif!");

      socket.current.on("webrtc-answer", async (answer) => {
        try {
          if (peerConnection.current && peerConnection.current.signalingState === "have-local-offer") {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (err) {
          console.error("Gagal Answer:", err);
        }
      });

      socket.current.on("webrtc-candidate", async (candidate) => {
        try {
          if (peerConnection.current && peerConnection.current.remoteDescription) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error("Gagal ICE Candidate:", err);
        }
      });

    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Kamera HP (Sender)</h2>
        <div className={`text-xs inline-block px-2 py-1 rounded-full mx-auto ${status.includes("Error") ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
          ● {status}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video shadow-2xl border-4 border-white">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover mirror-mode"
        />
      </div>

      <button
        onClick={startStream}
        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all hover:bg-emerald-700"
      >
        Mulai Stream Kamera HD
      </button>

      <p className="text-[10px] text-slate-400 italic">
        Pastikan HP & Laptop di jaringan WiFi yang sama
      </p>
    </div>
  );
}