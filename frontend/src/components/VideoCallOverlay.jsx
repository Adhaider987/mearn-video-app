import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Smile, 
  Maximize2, 
  Settings 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoCallOverlay = ({ callData, onClose }) => {
  const { user } = useAuth();
  const socket = useSocket();
  const { roomId, friend, type } = callData;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
  const [peers, setPeers] = useState({}); // userId -> RTCPeerConnection
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
  const [reactions, setReactions] = useState([]); // List of active floating emojis

  const localVideoRef = useRef(null);

  // Initialize Media
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        // Join the signaling room
        socket.emit("join-room", roomId);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Could not access camera or microphone.");
        onClose();
      }
    };

    startMedia();

    return () => {
      socket.emit("leave-room", roomId);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const createPeerConnection = useCallback((targetUserId, targetSocketId, isOffer) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          to: targetSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
          roomId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: event.streams[0]
      }));
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    return pc;
  }, [localStream, socket, roomId]);

  useEffect(() => {
    if (!socket || !localStream) return;

    const handleSignal = async ({ from, userId: signalingUserId, signal }) => {
      let pc = peers[signalingUserId];

      if (!pc) {
        pc = createPeerConnection(signalingUserId, from, false);
        setPeers(prev => ({ ...prev, [signalingUserId]: pc }));
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", { to: from, signal: { type: 'answer', sdp: answer }, roomId });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    };

    const handlePeerJoined = async ({ socketId, userId: joinedUserId }) => {
      console.log("Peer joined:", joinedUserId);
      const pc = createPeerConnection(joinedUserId, socketId, true);
      setPeers(prev => ({ ...prev, [joinedUserId]: pc }));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { to: socketId, signal: { type: 'offer', sdp: offer }, roomId });
    };

    const handlePeerLeft = ({ userId: leftUserId }) => {
      if (peers[leftUserId]) {
        peers[leftUserId].close();
        const newPeers = { ...peers };
        delete newPeers[leftUserId];
        setPeers(newPeers);
        
        const newStreams = { ...remoteStreams };
        delete newStreams[leftUserId];
        setRemoteStreams(newStreams);
      }
    };

    const handleReaction = ({ reaction }) => {
      const id = Date.now();
      setReactions(prev => [...prev, { id, emoji: reaction }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    };

    socket.on("signal", handleSignal);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("peer-left", handlePeerLeft);
    socket.on("reaction", handleReaction);

    return () => {
      socket.off("signal");
      socket.off("peer-joined");
      socket.off("peer-left");
      socket.off("reaction");
    };
  }, [socket, localStream, peers, createPeerConnection, remoteStreams]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const sendReaction = (emoji) => {
    socket.emit("reaction", { roomId, reaction: emoji });
    // Also show locally
    const id = Date.now();
    setReactions(prev => [...prev, { id, emoji }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 4000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={overlayStyle}
    >
      {/* Reactions Display */}
      <div style={reactionOverlay}>
        <AnimatePresence>
          {reactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ y: 0, opacity: 0, x: Math.random() * 100 - 50 }}
              animate={{ y: -400, opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              style={floatingEmoji}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header style={callHeader}>
        <div style={callInfo}>
          <div style={pulse}></div>
          <h3>{friend.username}</h3>
          <span style={timeStyle}>00:00</span>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={24} /></button>
      </header>

      <div style={videoGrid}>
        {/* Remote Videos */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <div key={userId} style={videoCard}>
            <RemoteVideo stream={stream} />
            <div style={labelStyle}>{friend.username}</div>
          </div>
        ))}
        
        {/* Local Video */}
        <div style={localVideoCard}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            style={videoStyle} 
          />
          <div style={labelStyle}>You</div>
        </div>
      </div>

      <footer style={callFooter}>
        <div style={controlsRow}>
          <button onClick={toggleMute} style={isMuted ? controlBtnOff : controlBtn}>
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button onClick={toggleVideo} style={isVideoOff ? controlBtnOff : controlBtn}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          
          <div style={reactionRow}>
            <button onClick={() => sendReaction('❤️')} style={reactionBtn}>❤️</button>
            <button onClick={() => sendReaction('👍')} style={reactionBtn}>👍</button>
            <button onClick={() => sendReaction('😂')} style={reactionBtn}>😂</button>
            <button onClick={() => sendReaction('👏')} style={reactionBtn}>👏</button>
            <button onClick={() => sendReaction('🔥')} style={reactionBtn}>🔥</button>
          </div>

          <button onClick={onClose} style={hangupBtn}>
            <PhoneOff size={24} />
          </button>
        </div>
      </footer>
    </motion.div>
  );
};

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef();
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline style={videoStyle} />;
};

// Styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "#0a0a0b",
  zIndex: 100,
  display: "flex",
  flexDirection: "column",
  color: "#fff",
};

const callHeader = {
  padding: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
  zIndex: 10,
};

const callInfo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const pulse = {
  width: "10px",
  height: "10px",
  background: "#ef4444",
  borderRadius: "50%",
  boxShadow: "0 0 10px #ef4444",
  animation: "pulse 2s infinite",
};

const timeStyle = {
  opacity: 0.6,
  fontSize: "14px",
};

const closeBtn = {
  background: "rgba(255,255,255,0.1)",
  border: "none",
  color: "#fff",
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const videoGrid = {
  flex: 1,
  padding: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
  gap: "20px",
  alignItems: "center",
  justifyContent: "center",
};

const videoCard = {
  position: "relative",
  width: "100%",
  height: "100%",
  maxHeight: "500px",
  borderRadius: "24px",
  overflow: "hidden",
  background: "#16171d",
  border: "1px solid rgba(255,255,255,0.1)",
};

const localVideoCard = {
  ...videoCard,
  width: "240px",
  height: "160px",
  position: "absolute",
  bottom: "120px",
  right: "40px",
  zIndex: 20,
  boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
};

const videoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const labelStyle = {
  position: "absolute",
  bottom: "16px",
  left: "16px",
  background: "rgba(0,0,0,0.5)",
  padding: "4px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  backdropFilter: "blur(4px)",
};

const callFooter = {
  padding: "40px",
  background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
  display: "flex",
  justifyContent: "center",
  zIndex: 10,
};

const controlsRow = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
  background: "rgba(255,255,255,0.1)",
  padding: "12px 24px",
  borderRadius: "24px",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const controlBtn = {
  width: "56px",
  height: "56px",
  borderRadius: "18px",
  border: "none",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const controlBtnOff = {
  ...controlBtn,
  background: "#ef4444",
};

const hangupBtn = {
  ...controlBtn,
  background: "#ef4444",
  width: "72px",
};

const reactionRow = {
  display: "flex",
  gap: "10px",
  padding: "0 20px",
  borderLeft: "1px solid rgba(255,255,255,0.1)",
  borderRight: "1px solid rgba(255,255,255,0.1)",
};

const reactionBtn = {
  fontSize: "24px",
  background: "none",
  border: "none",
};

const reactionOverlay = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 50,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
};

const floatingEmoji = {
  fontSize: "48px",
  position: "absolute",
};

export default VideoCallOverlay;
