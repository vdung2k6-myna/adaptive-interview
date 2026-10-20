/**
 * The audio-thread half of a recording.
 *
 * The main thread cannot see a microphone's samples without an AudioWorklet: a
 * MediaRecorder hands over an encoded container instead, and a container cannot be
 * decoded one piece at a time. This processor receives the graph's blocks and
 * copies them to the main thread, where they are converted a window at a time.
 *
 * The copy is deliberate. The arrays passed to `process()` are reused by the audio
 * thread for the next block, so posting them without copying would hand the main
 * thread a buffer that changes underneath it.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      this.port.postMessage(input.map((channel) => channel.slice()));
    }
    // Keep the processor alive for as long as the graph runs.
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
