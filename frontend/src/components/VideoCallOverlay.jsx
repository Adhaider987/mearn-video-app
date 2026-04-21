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
  Settings,
  Monitor,
  MonitorOff
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
  const { roomId, friend, type, isIncoming, status: initialStatus } = callData;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
  const [peers, setPeers] = useState({}); // userId -> RTCPeerConnection
  const [callStatus, setCallStatus] = useState(initialStatus || (isIncoming ? 'ringing' : 'connecting'));
  const [remoteDeviceStatus, setRemoteDeviceStatus] = useState(() => {
    // INITIAL STATUS: If audio call, suggest everyone starts with video off
    if (type === 'audio') {
      return { [friend._id]: { videoOff: true } };
    }
    return {};
  }); // userId -> { videoOff: bool, audioMuted: bool }
  const pendingCandidates = useRef({}); // userId -> [candidates]
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio'); // Default off for audio calls
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [reactions, setReactions] = useState([]); // List of active floating emojis

  const localVideoRef = useRef(null);
  const [currentType, setCurrentType] = useState(type); // Track negotiated call mode

  // PERSISTENCE: Ensure local video preview is always linked to stream
  useEffect(() => {
    if (localVideoRef.current && localStream && !isVideoOff) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff, currentType]);

  // Initialize Media
  useEffect(() => {
    if (callStatus === 'ringing') return; // PRIVACY: Do not access camera/mic until accepted

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video', // Only request video if it's a video call
          audio: true,
        });

        // If audio call, ensure tracks are disabled immediately as backup
        if (type === 'audio') {
          stream.getVideoTracks().forEach(t => t.enabled = false);
        }

        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        socket.emit("join-room", roomId);

        if (!isIncoming) {
          socket.emit("start-call", {
            targetUserId: friend._id,
            type: type,
            roomId: roomId
          });
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Could not access camera or microphone. Please check permissions.");
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
  }, [callStatus]); // Trigger when ringing -> connecting (on accept)

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
        let pData = peers[signalingUserId];
        let pc = pData?.pc;

        if (!pc) {
          pc = createPeerConnection(signalingUserId, from, false);
          setPeers(prev => ({ ...prev, [signalingUserId]: { pc, socketId: from } }));
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

    const handlePeerJoined = async ({ socketId: joinedSocketId, userId: joinedUserId }) => {
      const pc = createPeerConnection(joinedUserId, joinedSocketId, true);
      setPeers(prev => ({ ...prev, [joinedUserId]: { pc, socketId: joinedSocketId } }));
 
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { to: joinedSocketId, signal: { type: 'offer', sdp: offer }, roomId });
    };

    const handlePeerLeft = ({ userId: leftUserId }) => {
      if (peers[leftUserId]) {
        peers[leftUserId].pc.close();
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

    const handleDeviceStatus = ({ userId: peerId, status }) => {
      setRemoteDeviceStatus(prev => ({
        ...prev,
        [peerId]: { ...prev[peerId], ...status }
      }));

      // SYNC: If the remote user changed the call type (upgrade/downgrade), we should match it
      if (status.callType) {
        setCurrentType(status.callType);
      }
    };

    const handleCallEnded = () => {
      onClose();
    };

    socket.on("signal", handleSignal);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("peer-left", handlePeerLeft);
    socket.on("reaction", handleReaction);
    socket.on("call-ended", handleCallEnded);
    socket.on("device-status", handleDeviceStatus);

    return () => {
      socket.off("signal");
      socket.off("peer-joined");
      socket.off("peer-left");
      socket.off("reaction");
      socket.off("call-ended");
      socket.off("device-status");
    };
  }, [socket, localStream, peers, createPeerConnection, remoteStreams, callStatus]);

  const emitOffer = async (targetUserId) => {
    const pc = peers[targetUserId];
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // We need the socket ID for signaling, which we get from the peers map keys usually
      // or we can just broadcast to the room if it's one-on-one for now
      // Our existing peers state doesn't store socketId, but handleSignal/handlePeerJoined do.
      // For now, let's just trigger renegotiation needed or reuse the signaling logic.
    } catch (err) {
      console.error("Renegotiation error:", err);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      socket.emit("device-status", { roomId, status: { audioMuted: !isMuted } });
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;

    let vTrack = localStream.getVideoTracks()[0];

    if (isVideoOff) {
      // UPGRADE: Turning Camera ON
      if (!vTrack) {
        try {
          const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
          vTrack = freshStream.getVideoTracks()[0];
          localStream.addTrack(vTrack);
          
          // Push to all peers
          for (const [pId, pData] of Object.entries(peers)) {
            const { pc, socketId } = pData;
            const sender = pc.getSenders().find(s => s.track?.kind === 'video' || (s.track === null && pc.getTransceivers().find(t => t.sender === s && t.receiver.track.kind === 'video')));
            
            if (sender) {
              await sender.replaceTrack(vTrack);
            } else {
              pc.addTrack(vTrack, localStream);
            }

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", { to: socketId, signal: { type: 'offer', sdp: offer }, roomId });
          }
          setIsVideoOff(false);
          setCurrentType('video');
          socket.emit("device-status", { roomId, status: { videoOff: false, callType: 'video' } });
          setLocalStream(new MediaStream(localStream.getTracks()));
        } catch (err) {
          console.error("Failed to upgrade to video:", err);
          alert("Could not access camera");
          return;
        }
      } else {
        vTrack.enabled = true;
        setIsVideoOff(false);
        setCurrentType('video');
        socket.emit("device-status", { roomId, status: { videoOff: false, callType: 'video' } });
        setLocalStream(new MediaStream(localStream.getTracks()));
      }
    } else {
      // DOWNGRADE: Turning Camera OFF
      if (vTrack) {
        vTrack.enabled = false;
        vTrack.stop();
        localStream.removeTrack(vTrack);
        
        for (const [pId, pData] of Object.entries(peers)) {
          const { pc, socketId } = pData;
          const sender = pc.getSenders().find(s => s.track === vTrack || s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(null);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", { to: socketId, signal: { type: 'offer', sdp: offer }, roomId });
        }

        setIsVideoOff(true);
        setCurrentType('audio');
        socket.emit("device-status", { roomId, status: { videoOff: true, callType: 'audio' } });
        setLocalStream(new MediaStream(localStream.getTracks()));
      }
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

  const handleAccept = () => {
    setCallStatus('connecting');
    socket.emit("call-response", { callerId: friend._id, accept: true, roomId });
  };

  const handleDecline = () => {
    socket.emit("call-response", { callerId: friend._id, accept: false, roomId });
    onClose();
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];

      // Replace track for all peers
      Object.values(peers).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      setScreenStream(stream);
      setIsSharingScreen(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      screenTrack.onended = () => stopScreenShare();
      
      socket.emit("device-status", { roomId, status: { sharingScreen: true } });
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    
    // Switch back to camera
    const cameraTrack = localStream.getVideoTracks()[0];
    Object.values(peers).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(cameraTrack);
    });

    setScreenStream(null);
    setIsSharingScreen(false);
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    
    socket.emit("device-status", { roomId, status: { sharingScreen: false } });
  };

  // Ringing View
  if (callStatus === 'ringing') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-premium-bg flex items-center justify-center z-[1000]"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative w-[120px] h-[120px]">
            <div className="w-full h-full rounded-[40px] bg-premium-accent flex items-center justify-center text-white text-[48px] font-bold relative z-[2] uppercase">
              {friend.username[0]}
            </div>
            <div className="absolute inset-[-10px] rounded-[48px] border-4 border-premium-accent animate-pulse-custom z-[1]"></div>
          </div>
          <h2 className="text-white mt-6 text-2xl font-bold">{friend.username}</h2>
          <p className="text-white/60">Incoming {type} call...</p>
          
          <div className="flex gap-8 mt-12">
            <button 
              onClick={handleDecline} 
              className="w-[72px] h-[72px] rounded-3xl bg-red-500 flex items-center justify-center text-white shadow-xl"
            >
              <X size={32} />
            </button>
            <button 
              onClick={handleAccept} 
              className="w-[72px] h-[72px] rounded-3xl bg-green-500 flex items-center justify-center text-white shadow-xl"
            >
              {type === 'video' ? <Video size={32} /> : <Mic size={32} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Check if anyone (including self) is sharing screen
  const remoteSharing = Object.values(remoteDeviceStatus).find(s => s.sharingScreen);
  const spotlightUserId = Object.keys(remoteDeviceStatus).find(uid => remoteDeviceStatus[uid].sharingScreen);
  const isAnySharing = isSharingScreen || !!remoteSharing;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-premium-bg flex flex-col z-[1000] overflow-hidden"
    >
      {/* Reactions Display */}
      <div className="absolute inset-0 pointer-events-none z-[50] flex justify-center items-end">
        <AnimatePresence>
          {reactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ y: 0, opacity: 1, scale: 0.5 }}
              animate={{ y: -400, opacity: 0, scale: 2 }}
              exit={{ opacity: 0 }}
              className="text-[48px] absolute"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header className="px-10 py-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="glass px-4 py-2 rounded-xl text-sm border border-white/10">
            {isAnySharing ? "📺 Presentation Mode" : "👥 Group Call"}
          </div>
        </div>
        <button onClick={handleHangUp} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <X size={24} />
        </button>
      </header>

      {isAnySharing ? (
        <div className="flex-1 grid grid-cols-1 grid-rows-[1fr_auto] gap-4 p-6 overflow-hidden">
          <div className="bg-black rounded-[32px] overflow-hidden relative shadow-premium border border-white/10">
            {isSharingScreen ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <RemoteVideo stream={remoteStreams[spotlightUserId]} />
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-xs">
              {isSharingScreen ? "Your Screen" : `${friend.username}'s Screen`}
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {!isSharingScreen && (
              <div className="w-[160px] aspect-[4/3] relative flex-shrink-0 rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-premium-bg-alt">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px]">You</div>
              </div>
            )}
            {Object.entries(remoteStreams).filter(([uid]) => uid !== spotlightUserId).map(([peerId, stream]) => (
              <div key={peerId} className="w-[160px] aspect-[4/3] relative flex-shrink-0 rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-premium-bg-alt">
                <RemoteVideo stream={stream} />
                <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px]">{friend.username}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-5 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3 items-center justify-center overflow-y-auto">
           {/* Remote Videos */}
          {Object.entries(remoteStreams).map(([peerId, stream]) => {
            const isPeerVideoOff = remoteDeviceStatus[peerId]?.videoOff;
            return (
              <div key={peerId} className="relative w-full aspect-video rounded-[24px] overflow-hidden bg-[#16171d] border border-white/10">
                {isPeerVideoOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#1f2028] gap-3">
                    <div className="w-16 h-16 rounded-[20px] bg-premium-accent flex items-center justify-center text-white text-2xl font-bold uppercase">
                      {friend.username[0]}
                    </div>
                    <p className="text-sm">Camera Off</p>
                  </div>
                ) : (
                  <RemoteVideo key={peerId} stream={stream} />
                )}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-xs flex items-center">
                  {friend.username} {remoteDeviceStatus[peerId]?.audioMuted && <MicOff size={14} className="ml-1" />}
                </div>
              </div>
            );
          })}
          
          {/* Local Video */}
          <div className="relative w-full aspect-video rounded-[24px] overflow-hidden bg-[#16171d] border border-white/10">
            {isVideoOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#1f2028] gap-3">
                <div className="w-16 h-16 rounded-[20px] bg-premium-accent flex items-center justify-center text-white text-2xl font-bold uppercase">
                  {user.username[0]}
                </div>
                <p className="text-sm">Camera Off</p>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-xs">You</div>
          </div>
        </div>
      )}

      {/* Premium Dock */}
      <div className="premium-dock translate-y-0 !bottom-10 h-auto">
        <button onClick={toggleMute} className={`dock-btn ${isMuted ? 'danger' : ''}`}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={toggleVideo} className={`dock-btn ${isVideoOff ? 'danger' : ''}`}>
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
        <button onClick={isSharingScreen ? stopScreenShare : startScreenShare} className={`dock-btn ${isSharingScreen ? 'active' : ''}`}>
          {isSharingScreen ? <MonitorOff size={22} /> : <Monitor size={22} />}
        </button>
        
        <div className="w-[1px] h-6 bg-white/10 mx-2" />
        
        <button onClick={() => sendReaction("🚀")} className="dock-btn text-[22px]">🚀</button>
        <button onClick={() => sendReaction("🔥")} className="dock-btn text-[22px]">🔥</button>
        <button onClick={handleHangUp} className="w-[72px] h-[52px] rounded-[20px] bg-red-500 flex items-center justify-center text-white shadow-lg">
          <PhoneOff size={22} />
        </button>
      </div>
    </motion.div>
  );
};

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef();
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle track additions to existing stream
  useEffect(() => {
    if (!stream) return;
    const handleTrack = () => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    };
    stream.addEventListener('addtrack', handleTrack);
    stream.addEventListener('removetrack', handleTrack);
    return () => {
      stream.removeEventListener('addtrack', handleTrack);
      stream.removeEventListener('removetrack', handleTrack);
    };
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
};

export default VideoCallOverlay;
