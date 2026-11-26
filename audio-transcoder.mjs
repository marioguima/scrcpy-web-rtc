import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";

export async function createAudioTranscoder(onPacket, { input = "pcm" } = {}) {
    const socket = createSocket("udp4");
    await new Promise((resolve, reject) => {
        socket.once("error", reject);
        socket.bind(0, "127.0.0.1", resolve);
    });
    const port = socket.address().port;
    const inputArgs = input === "aac"
        ? ["-f", "aac", "-i", "pipe:0"]
        : ["-f", "s16le", "-ar", "48000", "-ac", "2", "-i", "pipe:0"];
    const processo = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error", ...inputArgs,
        "-c:a", "libopus", "-application", "lowdelay", "-frame_duration", "20",
        "-payload_type", "111", "-f", "rtp", `rtp://127.0.0.1:${port}`,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    console.log(`[audio] PCM->Opus transcoder started on RTP port ${port}`);
    processo.stderr.on("data", (data) => console.error(`[audio] ${String(data).trim()}`));
    processo.stdin.on("error", (error) => console.error(`[audio] ffmpeg stdin: ${error.code ?? error.message}`));
    processo.on("error", (error) => console.error(`[audio] ffmpeg spawn error: ${error.message}`));
    processo.on("exit", (code, signal) => console.log(`[audio] ffmpeg exited code=${code} signal=${signal ?? "none"}`));
    let packets = 0;
    let minPayload = Infinity;
    let maxPayload = 0;
    socket.on("message", (data) => {
        if (data.length < 12) return;
        const csrc = (data[0] & 0x0f) * 4;
        const extension = (data[0] & 0x10) ? 4 + data.readUInt16BE(12) * 4 : 0;
        const inicio = 12 + csrc + extension;
        if (inicio < data.length) {
            packets++;
            const payloadSize = data.length - inicio;
            minPayload = Math.min(minPayload, payloadSize);
            maxPayload = Math.max(maxPayload, payloadSize);
            if (packets === 1) console.log(`[audio] first Opus RTP packet received (${payloadSize} bytes)`);
            else if (packets % 500 === 0) console.log(`[audio] Opus RTP packets=${packets} payload=${payloadSize}B range=${minPayload}-${maxPayload}B`);
            onPacket({ sequence: data.readUInt16BE(2), timestamp: data.readUInt32BE(4), payload: data.subarray(inicio) });
        }
    });
    return {
        write(data) { if (!processo.stdin.destroyed && processo.exitCode === null) processo.stdin.write(data); },
        writeAac(data, config) {
            if (processo.stdin.destroyed || processo.exitCode !== null) return;
            // scrcpy sends AAC access units without an ADTS header. Build one
            // from AudioSpecificConfig so ffmpeg can demux the stream.
            if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0) {
                processo.stdin.write(data);
                return;
            }
            const asc = config ?? new Uint8Array([0x11, 0x90]); // AAC-LC, 48 kHz, stereo
            const audioObjectType = (asc[0] >> 3) & 0x1f;
            const sampleRateIndex = ((asc[0] & 0x07) << 1) | (asc[1] >> 7);
            const channelConfig = (asc[1] >> 3) & 0x0f;
            const profile = Math.max(0, Math.min(3, audioObjectType - 1));
            const frameLength = data.length + 7;
            const header = Buffer.alloc(7);
            header[0] = 0xff;
            header[1] = 0xf1;
            header[2] = (profile << 6) | (sampleRateIndex << 2) | (channelConfig >> 2);
            header[3] = ((channelConfig & 3) << 6) | ((frameLength >> 11) & 3);
            header[4] = (frameLength >> 3) & 0xff;
            header[5] = ((frameLength & 7) << 5) | 0x1f;
            header[6] = 0xfc;
            processo.stdin.write(Buffer.concat([header, Buffer.from(data)]));
        },
        close() { try { processo.stdin.end(); } catch {} socket.close(); processo.kill(); },
    };
}
