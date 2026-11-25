import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";

export async function createAudioTranscoder(onPacket) {
    const socket = createSocket("udp4");
    await new Promise((resolve, reject) => {
        socket.once("error", reject);
        socket.bind(0, "127.0.0.1", resolve);
    });
    const port = socket.address().port;
    const processo = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "s16le", "-ar", "48000", "-ac", "2", "-i", "pipe:0",
        "-c:a", "libopus", "-application", "lowdelay", "-frame_duration", "20",
        "-payload_type", "111", "-f", "rtp", `rtp://127.0.0.1:${port}`,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    processo.stderr.on("data", (data) => console.error(`[audio] ${String(data).trim()}`));
    socket.on("message", (data) => {
        if (data.length < 12) return;
        const csrc = (data[0] & 0x0f) * 4;
        const extension = (data[0] & 0x10) ? 4 + data.readUInt16BE(12) * 4 : 0;
        const inicio = 12 + csrc + extension;
        if (inicio < data.length) onPacket({ sequence: data.readUInt16BE(2), timestamp: data.readUInt32BE(4), payload: data.subarray(inicio) });
    });
    return {
        write(data) { if (!processo.stdin.destroyed) processo.stdin.write(data); },
        close() { try { processo.stdin.end(); } catch {} socket.close(); processo.kill(); },
    };
}
