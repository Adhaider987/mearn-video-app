import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  getSignalingSocket,
  SIGNALING_URL,
} from "../signalingSocket.js";

const socket = getSignalingSocket();

function parseIceServers() {
  const defaults = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (!raw) return defaults;
  try {
    const extra = JSON.parse(raw);
    if (Array.isArray(extra) && extra.length) return [...defaults, ...extra];
  } catch {
    /* ignore invalid JSON */
  }
  return defaults;
}

function getMediaErrorMessage(err) {
  if (err?.message === "NOT_SECURE_CONTEXT") {
    return [
      "This page is not a secure context, so the browser blocks camera/microphone.",
      "Use https:// or open via http://localhost / http://127.0.0.1 only.",
    ].join(" ");
  }
  if (err?.message === "NO_GET_USER_MEDIA") {
    return "Your browser does not expose camera/microphone here (try Chrome/Edge/Firefox, not an in-app browser).";
  }
  const name = err?.name;
  if (name === "NotAllowedError") {
    return "Permission denied. Allow camera and microphone for this site.";
  }
  if (name === "NotFoundError") {
    return "No camera or microphone was found.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera or microphone is busy. Close other apps using it and retry.";
  }
  if (name === "OverconstrainedError") {
    return "Your device cannot satisfy the requested video/audio constraints.";
  }
  return err?.message || "Could not open camera/microphone.";
}

/** @typedef {'idle' | 'waiting' | 'outgoing_ringing' | 'incoming_ringing' | 'awaiting_offer' | 'in_call'} CallPhase */

const RING_TIMEOUT_MS = 60_000;

const VideoCall = () => {
  const [roomId, setRoomId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [callPhase, setCallPhase] = useState(/** @type {CallPhase} */ ("idle"));
  const [statusNote, setStatusNote] = useState("");

  const [incomingName, setIncomingName] = useState("");

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStreamRef = useRef(null);
  const mediaAcquireRef = useRef(null);
  const roomIdRef = useRef("");
  const callPhaseRef = useRef(/** @type {CallPhase} */ ("idle"));
  const pendingCallerIdRef = useRef(null);
  const outgoingRingTimerRef = useRef(null);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  // `<video>` refs must exist before getUserMedia resolves; we also re-bind after phase-driven mounts.
  useLayoutEffect(() => {
    const lv = localVideo.current;
    const ls = localStream.current;
    if (lv && ls) {
      lv.srcObject = ls;
    }
    const rv = remoteVideo.current;
    const rs = remoteStreamRef.current;
    if (rv && rs) {
      rv.srcObject = rs;
    }
  }, [callPhase]);

  const clearOutgoingRingTimer = useCallback(() => {
    if (outgoingRingTimerRef.current) {
      clearTimeout(outgoingRingTimerRef.current);
      outgoingRingTimerRef.current = null;
    }
  }, []);

  const resetMediaAndPeer = useCallback(() => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    remoteStreamRef.current = null;
    mediaAcquireRef.current = null;
  }, []);

  const ensureLocalMedia = async () => {
    if (localStream.current) return localStream.current;
    if (mediaAcquireRef.current) return mediaAcquireRef.current;
    if (!window.isSecureContext) throw new Error("NOT_SECURE_CONTEXT");
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("NO_GET_USER_MEDIA");
    }

    mediaAcquireRef.current = navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      })
      .then((stream) => {
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        return stream;
      })
      .finally(() => {
        mediaAcquireRef.current = null;
      });

    return mediaAcquireRef.current;
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: parseIceServers(),
    });

    /** ICE from the peer often arrives before `setRemoteDescription`; queue until remote SDP is applied. */
    /** @type {(RTCIceCandidateInit | null)[]} */
    const remoteIceQueue = [];

    const flushRemoteIceQueue = async () => {
      while (remoteIceQueue.length > 0) {
        const init = remoteIceQueue.shift();
        try {
          await pc.addIceCandidate(
            init != null ? new RTCIceCandidate(init) : null,
          );
        } catch (err) {
          console.warn("addIceCandidate (flush)", err);
        }
      }
    };

    pc._enqueueRemoteIce = async (candidateInit) => {
      if (!pc.remoteDescription) {
        remoteIceQueue.push(candidateInit);
        return;
      }
      try {
        await pc.addIceCandidate(
          candidateInit != null ? new RTCIceCandidate(candidateInit) : null,
        );
      } catch (err) {
        console.warn("addIceCandidate", err);
      }
    };

    pc._markRemoteDescriptionApplied = async () => {
      await flushRemoteIceQueue();
    };

    pc.onicecandidate = (event) => {
      const rid = roomIdRef.current;
      if (!rid) return;
      if (event.candidate) {
        const payload =
          typeof event.candidate.toJSON === "function"
            ? event.candidate.toJSON()
            : event.candidate;
        socket.emit("ice-candidate", { roomId: rid, candidate: payload });
      } else {
        socket.emit("ice-candidate", { roomId: rid, candidate: null });
      }
    };

    pc.ontrack = (event) => {
      const stream =
        event.streams[0] ?? new MediaStream([event.track]);
      remoteStreamRef.current = stream;
      const attach = () => {
        const el = remoteVideo.current;
        if (el) {
          el.srcObject = stream;
          return true;
        }
        return false;
      };
      if (!attach()) {
        queueMicrotask(() => {
          attach();
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "disconnected"
      ) {
        console.warn("ICE connection state:", pc.iceConnectionState);
      }
    };

    return pc;
  }, []);

  const enterRoom = () => {
    const rid = roomId.trim();
    if (!rid) {
      alert("Enter a room id first.");
      return;
    }
    setStatusNote("");
    socket.emit("join-room", rid, (ack) => {
      if (ack?.ok === false) {
        return;
      }
      setCallPhase("waiting");
    });
  };

  const leaveRoomSilently = () => {
    const rid = roomIdRef.current.trim();
    if (rid) socket.emit("leave-room", rid);
  };

  const hangUp = useCallback(() => {
    clearOutgoingRingTimer();
    const rid = roomIdRef.current.trim();
    const phase = callPhaseRef.current;

    if (phase === "outgoing_ringing" && rid) {
      socket.emit("call-cancel", { roomId: rid });
    }

    resetMediaAndPeer();
    leaveRoomSilently();

    setIncomingName("");
    pendingCallerIdRef.current = null;
    setCallPhase("idle");
    setStatusNote("You left the room.");
  }, [clearOutgoingRingTimer, resetMediaAndPeer]);

  const placeCall = () => {
    const rid = roomIdRef.current.trim();
    if (!rid) {
      alert("Enter a room id first.");
      return;
    }
    if (callPhaseRef.current !== "waiting") return;

    setStatusNote("");
    socket.emit("call-request", {
      roomId: rid,
      displayName: displayName.trim() || "Someone",
    });
    setCallPhase("outgoing_ringing");
  };

  const acceptIncoming = async () => {
    const callerId = pendingCallerIdRef.current;
    const rid = roomIdRef.current.trim();
    if (!callerId || !rid) return;

    try {
      await ensureLocalMedia();
    } catch (err) {
      console.error(err);
      alert(getMediaErrorMessage(err));
      return;
    }

    socket.emit("call-accept", { roomId: rid, callerId });
    setIncomingName("");
    pendingCallerIdRef.current = null;
    setCallPhase("awaiting_offer");
  };

  const rejectIncoming = () => {
    const callerId = pendingCallerIdRef.current;
    const rid = roomIdRef.current.trim();
    if (callerId && rid) {
      socket.emit("call-reject", { roomId: rid, callerId });
    }
    setIncomingName("");
    pendingCallerIdRef.current = null;
    setCallPhase("waiting");
    setStatusNote("Call declined.");
  };

  const cancelOutgoing = () => {
    const rid = roomIdRef.current.trim();
    clearOutgoingRingTimer();
    if (rid) socket.emit("call-cancel", { roomId: rid });
    setCallPhase("waiting");
    setStatusNote("Call cancelled.");
  };

  useEffect(() => {
    const onRoomError = (payload) => {
      setStatusNote(payload?.message || "Room error.");
      setCallPhase("idle");
    };

    const onJoinedRoom = () => {
      setStatusNote("In room — you can place a call or wait for one.");
    };

    const onCallFailed = (payload) => {
      setStatusNote(payload?.message || "Could not start call.");
      setCallPhase("waiting");
      clearOutgoingRingTimer();
    };

    const onIncomingCall = ({ from, displayName: name }) => {
      if (callPhaseRef.current !== "waiting") return;
      pendingCallerIdRef.current = from;
      setIncomingName(name || "Someone");
      setCallPhase("incoming_ringing");
    };

    const onCallAccepted = async () => {
      clearOutgoingRingTimer();
      try {
        await ensureLocalMedia();
      } catch (err) {
        console.error(err);
        alert(getMediaErrorMessage(err));
        setCallPhase("waiting");
        return;
      }

      peerConnection.current = createPeerConnection();
      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", {
        roomId: roomIdRef.current.trim(),
        offer,
      });
      setCallPhase("in_call");
    };

    const onCallRejected = () => {
      clearOutgoingRingTimer();
      setCallPhase("waiting");
      setStatusNote("The other person declined the call.");
    };

    const onCallCancelled = () => {
      setIncomingName("");
      pendingCallerIdRef.current = null;
      if (callPhaseRef.current === "incoming_ringing") {
        setCallPhase("waiting");
        setStatusNote("Caller cancelled.");
      }
    };

    const onOffer = async ({ offer }) => {
      if (callPhaseRef.current !== "awaiting_offer") return;

      try {
        if (!localStream.current) await ensureLocalMedia();
      } catch (err) {
        console.error(err);
        alert(getMediaErrorMessage(err));
        resetMediaAndPeer();
        setCallPhase("waiting");
        setStatusNote("Could not complete the connection.");
        return;
      }

      if (!peerConnection.current) {
        peerConnection.current = createPeerConnection();
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, localStream.current);
        });
      }

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer),
      );
      if (peerConnection.current._markRemoteDescriptionApplied) {
        await peerConnection.current._markRemoteDescriptionApplied();
      }
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", {
        roomId: roomIdRef.current.trim(),
        answer,
      });
      setCallPhase("in_call");
    };

    const onAnswer = async ({ answer }) => {
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
      if (peerConnection.current._markRemoteDescriptionApplied) {
        await peerConnection.current._markRemoteDescriptionApplied();
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      const pc = peerConnection.current;
      if (!pc || candidate === undefined) return;
      if (pc._enqueueRemoteIce) {
        await pc._enqueueRemoteIce(
          candidate === null ? null : candidate,
        );
      }
    };

    const onPeerLeft = () => {
      setStatusNote("The other person left the room.");
      resetMediaAndPeer();
      setIncomingName("");
      pendingCallerIdRef.current = null;
      clearOutgoingRingTimer();
      setCallPhase("waiting");
    };

    const onPeerDisconnected = () => {
      resetMediaAndPeer();
      setIncomingName("");
      pendingCallerIdRef.current = null;
      clearOutgoingRingTimer();
      const phase = callPhaseRef.current;
      if (phase === "idle") return;
      setStatusNote(
        phase === "awaiting_offer"
          ? "The other person disconnected before the call finished connecting."
          : "The other person disconnected.",
      );
      setCallPhase("waiting");
    };

    socket.on("room-error", onRoomError);
    socket.on("joined-room", onJoinedRoom);
    socket.on("call-failed", onCallFailed);
    socket.on("incoming-call", onIncomingCall);
    socket.on("call-accepted", onCallAccepted);
    socket.on("call-rejected", onCallRejected);
    socket.on("call-cancelled", onCallCancelled);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("peer-left", onPeerLeft);
    socket.on("peer-disconnected", onPeerDisconnected);

    return () => {
      socket.off("room-error", onRoomError);
      socket.off("joined-room", onJoinedRoom);
      socket.off("call-failed", onCallFailed);
      socket.off("incoming-call", onIncomingCall);
      socket.off("call-accepted", onCallAccepted);
      socket.off("call-rejected", onCallRejected);
      socket.off("call-cancelled", onCallCancelled);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("peer-left", onPeerLeft);
      socket.off("peer-disconnected", onPeerDisconnected);
    };
  }, [clearOutgoingRingTimer, createPeerConnection, resetMediaAndPeer]);

  useEffect(() => {
    if (callPhase !== "outgoing_ringing") return;

    outgoingRingTimerRef.current = setTimeout(() => {
      const rid = roomIdRef.current.trim();
      if (callPhaseRef.current === "outgoing_ringing" && rid) {
        socket.emit("call-cancel", { roomId: rid });
        setCallPhase("waiting");
        setStatusNote("No answer (timeout).");
      }
      outgoingRingTimerRef.current = null;
    }, RING_TIMEOUT_MS);

    return () => clearOutgoingRingTimer();
  }, [callPhase, clearOutgoingRingTimer]);

  useEffect(() => {
    return () => {
      resetMediaAndPeer();
      clearOutgoingRingTimer();
    };
  }, [clearOutgoingRingTimer, resetMediaAndPeer]);

  const showVideoChrome =
    callPhase === "outgoing_ringing" ||
    callPhase === "incoming_ringing" ||
    callPhase === "awaiting_offer" ||
    callPhase === "in_call";

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>
        Video call (1-to-1)
      </h1>
      <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
        Enter the same room on two devices. Receiver accepts before video
        connects.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          placeholder="Room id (e.g. room-123)"
          value={roomId}
          disabled={callPhase !== "idle"}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ padding: "10px 12px", width: 220, fontSize: 16 }}
        />
        <input
          type="text"
          placeholder="Your name (shown when you call)"
          value={displayName}
          disabled={
            callPhase === "incoming_ringing" ||
            callPhase === "outgoing_ringing" ||
            callPhase === "awaiting_offer" ||
            callPhase === "in_call"
          }
          onChange={(e) => setDisplayName(e.target.value)}
          style={{ padding: "10px 12px", width: 220, fontSize: 16 }}
        />
      </div>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {callPhase === "idle" && (
          <button
            type="button"
            onClick={enterRoom}
            style={btnPrimary}
          >
            Enter room
          </button>
        )}

        {callPhase === "waiting" && (
          <>
            <button type="button" onClick={placeCall} style={btnPrimary}>
              Call
            </button>
            <button
              type="button"
              onClick={hangUp}
              style={{ ...btnMuted, marginLeft: 8 }}
            >
              Leave room
            </button>
          </>
        )}

        {callPhase === "outgoing_ringing" && (
          <>
            <span style={{ marginRight: 12, color: "#333" }}>Calling…</span>
            <button type="button" onClick={cancelOutgoing} style={btnMuted}>
              Cancel
            </button>
          </>
        )}

        {(callPhase === "in_call" ||
          callPhase === "awaiting_offer") && (
          <button type="button" onClick={hangUp} style={btnDanger}>
            Hang up
          </button>
        )}
      </div>

      {statusNote && (
        <p style={{ textAlign: "center", color: "#666" }}>{statusNote}</p>
      )}

      {callPhase === "incoming_ringing" && (
        <div
          style={{
            ...modalWrap,
          }}
        >
          <div style={modalCard}>
            <h2 style={{ marginTop: 0 }}>Incoming call</h2>
            <p>
              <strong>{incomingName}</strong> is calling you.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" onClick={acceptIncoming} style={btnPrimary}>
                Accept
              </button>
              <button type="button" onClick={rejectIncoming} style={btnMuted}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {showVideoChrome && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          <div>
            <h3 style={{ textAlign: "center" }}>You</h3>
            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              style={videoStyle}
            />
          </div>
          <div>
            <h3 style={{ textAlign: "center" }}>Other</h3>
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              style={{ ...videoStyle, borderColor: "#16a34a" }}
            />
          </div>
        </div>
      )}

      <p style={{ marginTop: 24, textAlign: "center", color: "#888" }}>
        Signaling: <code>{SIGNALING_URL}</code>
      </p>
    </div>
  );
};

const btnPrimary = {
  padding: "12px 20px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  cursor: "pointer",
};

const btnMuted = {
  padding: "12px 20px",
  background: "#6b7280",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  cursor: "pointer",
};

const btnDanger = {
  padding: "12px 20px",
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
  cursor: "pointer",
};

const videoStyle = {
  width: "min(100%, 360px)",
  border: "3px solid #374151",
  borderRadius: 12,
  background: "#111",
};

const modalWrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalCard = {
  background: "#fff",
  padding: 24,
  borderRadius: 12,
  maxWidth: 400,
  width: "90%",
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};

export default VideoCall;
