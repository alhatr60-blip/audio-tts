// frontend/src/App.js
import React, { useState, useRef } from "react";

const API_BASE = "http://localhost:4000"; // adjust if backend runs elsewhere

function App() {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const [textForTTS, setTextForTTS] = useState("");
  const audioPlayerRef = useRef();

  // Start recording
  const startRecording = async () => {
    setTranscript("");
    setStatus("Asking for microphone permission...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        setAudioChunks(chunks);
        setStatus("Recording stopped. Ready to upload.");
      };
      mr.start();
      setMediaRecorder(mr);
      setAudioChunks([]);
      setRecording(true);
      setStatus("Recording...");
    } catch (err) {
      console.error(err);
      setStatus("Microphone permission denied or error: " + err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // Upload the recorded audio to backend
  const uploadRecording = async () => {
    if (!audioChunks || audioChunks.length === 0) {
      setStatus("No recording available. Please record first.");
      return;
    }
    setStatus("Uploading audio...");
    const blob = new Blob(audioChunks, { type: "audio/webm" }); // MediaRecorder default on many browsers
    const fd = new FormData();
    fd.append("audio", blob, "recording.webm");

    try {
      const resp = await fetch(`${API_BASE}/transcribe`, {
        method: "POST",
        body: fd
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        setStatus("Transcription failed: " + (err?.error || resp.statusText));
        return;
      }
      const data = await resp.json();
      setTranscript(data.text || "");
      setStatus("Transcription complete.");
    } catch (err) {
      console.error(err);
      setStatus("Upload error: " + err.message);
    }
  };

  // Client-side TTS using browser speechSynthesis
  const speakClient = () => {
    if (!textForTTS) return;
    const utter = new SpeechSynthesisUtterance(textForTTS);
    // Optionally set voice, pitch, rate:
    // utter.voice = speechSynthesis.getVoices()[0];
    utter.rate = 1;
    speechSynthesis.speak(utter);
  };

  // Server-side TTS (sends text to /synthesize and plays returned audio)
  const speakServer = async () => {
    if (!textForTTS) return;
    setStatus("Requesting server TTS...");
    try {
      const resp = await fetch(`${API_BASE}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textForTTS })
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => null);
        setStatus("Server TTS error: " + (j?.error || resp.statusText));
        return;
      }

      // We expect audio binary (e.g., audio/mpeg). Support both arrayBuffer and blob.
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const j = await resp.json();
        setStatus("Server TTS response: " + (j?.error || "No audio returned"));
        return;
      }

      const arrayBuffer = await resp.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: contentType || "audio/wav" });
      const url = URL.createObjectURL(blob);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play();
      } else {
        const audio = new Audio(url);
        audio.play();
      }
      setStatus("Playing server audio...");
    } catch (err) {
      console.error(err);
      setStatus("Server TTS error: " + err.message);
    }
  };

  // Simple UI
  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Audio → Text & Text → Audio (Demo)</h1>
      <section style={{ marginBottom: 24 }}>
        <h3>Record audio (browser) → Transcribe</h3>
        <div>
          <button onClick={startRecording} disabled={recording} style={{ marginRight: 8 }}>
            Start Recording
          </button>
          <button onClick={stopRecording} disabled={!recording} style={{ marginRight: 8 }}>
            Stop
          </button>
          <button onClick={uploadRecording} style={{ marginRight: 8 }}>
            Upload & Transcribe
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>Transcript:</strong>
          <div style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 6, minHeight: 60 }}>
            {transcript || <i>Transcript will appear here</i>}
          </div>
        </div>
      </section>

      <hr />

      <section style={{ marginTop: 24 }}>
        <h3>Text → Audio</h3>
        <textarea
          value={textForTTS}
          onChange={(e) => setTextForTTS(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 8 }}
          placeholder="Type text here..."
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={speakClient} style={{ marginRight: 8 }}>
            Speak (Browser speechSynthesis)
          </button>
          <button onClick={speakServer}>Speak (Server TTS)</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <audio ref={audioPlayerRef} controls style={{ width: "100%" }} />
        </div>
      </section>
    </div>
  );
}

export default App;



