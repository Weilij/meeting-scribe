export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private _sampleRate = 44100;
  private _analyser: AnalyserNode | null = null;

  get analyser() { return this._analyser; }
  get sampleRate() { return this._sampleRate; }

  async start(): Promise<AnalyserNode> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioContext = new AudioContext();
    this._sampleRate = this.audioContext.sampleRate;

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this._analyser = this.audioContext.createAnalyser();
    this._analyser.fftSize = 64;

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.chunks = [];

    this.processor.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(this._analyser);
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    return this._analyser;
  }

  stop(): ArrayBuffer {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.processor?.disconnect();
    this.audioContext?.close();

    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const combined = new Float32Array(total);
    let offset = 0;
    for (const c of this.chunks) { combined.set(c, offset); offset += c.length; }

    return encodeWAV(combined, this._sampleRate);
  }

  cancel() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.processor?.disconnect();
    this.audioContext?.close();
    this.chunks = [];
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buf;
}
