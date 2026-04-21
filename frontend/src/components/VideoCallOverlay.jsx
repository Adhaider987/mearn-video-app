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
  const { roomId, friend, type, isIncoming } = callData;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
  const [peers, setPeers] = useState({}); // userId -> RTCPeerConnection
  const pendingCandidates = useRef({}); // userId -> [candidates]
  
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

        // Notify the target user about the incoming call ONLY if we are the caller
        if (!isIncoming) {
          socket.emit("start-call", {
            targetUserId: friend._id,
            type: type,
            roomId: roomId
          });
        }
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
      try {
        let pc = peers[signalingUserId];

        if (!pc) {
          pc = createPeerConnection(signalingUserId, from, false);
          setPeers(prev => ({ ...prev, [signalingUserId]: pc }));
        }

        const drainQueue = async (userId, peerConnection) => {
          const queue = pendingCandidates.current[userId] || [];
          while (queue.length > 0) {
            const candidate = queue.shift();
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Failed to apply queued candidate", e);
            }
          }
          pendingCandidates.current[userId] = [];
        };

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { to: from, signal: { type: 'answer', sdp: answer }, roomId });
          await drainQueue(signalingUserId, pc);
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainQueue(signalingUserId, pc);
        } else if (signal.type === 'candidate') {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            if (!pendingCandidates.current[signalingUserId]) {
              pendingCandidates.current[signalingUserId] = [];
            }
            pendingCandidates.current[signalingUserId].push(signal.candidate);
          }
        }
      } catch (err) {
        console.error("Signaling error:", err);
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

        // Clear candidates queue
        delete pendingCandidates.current[leftUserId];
      }
    };

    const handleReaction = ({ reaction }) => {
      const id = Date.now();
      setReactions(prev => [...prev, { id, emoji: reaction }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    };

    const handleCallEnded = () => {
      console.log("Call ended by peer");
      onClose();
    };

    socket.on("signal", handleSignal);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("peer-left", handlePeerLeft);
    socket.on("reaction", handleReaction);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("signal");
      socket.off("peer-joined");
      socket.off("peer-left");
      socket.off("reaction");
      socket.off("call-ended");
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

  const handleHangUp = () => {
    socket.emit("hang-up", { roomId });
    onClose();
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
        <button onClick={handleHangUp} style={closeBtn}><X size={24} /></button>
      </header>

      <div className="video-grid">
        {/* Remote Videos */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <div key={userId} style={videoCard}>
            <RemoteVideo stream={stream} />
            <div style={labelStyle}>{friend.username}</div>
          </div>
        ))}
        
        {/* Local Video */}
        <div className="local-video-container">
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

      <footer className="call-footer" style={callFooter}>
        <div className="controls-row" style={controlsRow}>
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

          <button onClick={handleHangUp} style={hangupBtn}>
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
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", // Reduced min-width
  gap: "10px",
  alignItems: "center",
  justifyContent: "center",
  overflowY: "auto",
};

const videoCard = {
  position: "relative",
  width: "100%",
  height: "100%",
  maxHeight: "400px", // Reduced
  aspectRatio: "16/9",
  borderRadius: "24px",
  overflow: "hidden",
  background: "#16171d",
  border: "1px solid rgba(255,255,255,0.1)",
};

const localVideoCard = {
  ...videoCard,
  width: "min(160px, 30vw)",
  height: "auto",
  aspectRatio: "4/3",
  position: "absolute",
  bottom: "140px",
  right: "20px",
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
