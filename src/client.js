import {
    WebCodecsVideoDecoder,
    WebGLVideoFrameRenderer,
    BitmapVideoFrameRenderer,
} from "@yume-chan/scrcpy-decoder-webcodecs";
import { ScrcpyVideoCodecId } from "@yume-chan/scrcpy";
import { SignalRoom, b64u } from "../signal.mjs";
import { mountProductShell } from "./product-shell.jsx";
// xterm is ~300 KB of the bundle and only matters once the shell is opened,
// so it loads on demand
let Terminal = null;
let FitAddon = null;

async function loadXterm() {
    if (Terminal) return;
    const [xterm, fit, css] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/xterm/css/xterm.css"),
    ]);
    Terminal = xterm.Terminal;
    FitAddon = fit.FitAddon;
    document.head.appendChild(document.createElement("style")).textContent =
        css.default ?? css;
}

// STUN only — TURN servers, when the backend has them (--turn), arrive
// with the WebRTC offer
const ICE_SERVERS = [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
];

const STRINGS = {
    zh: {
        refresh: "刷新设备列表",
        fullscreen: "全屏",
        settings: "设置",
        quality: "画质",
        sound: "声音",
        power: "电源",
        back: "返回",
        home: "主页",
        recents: "最近任务",
        keyboard: "键盘",
        qAuto: "自动",
        qLow: "流畅",
        qMedium: "平衡",
        qHigh: "高清",
        encoder: "视频编码器",
        encoderAuto: "编码器：自动",
        encoderSwitched: (n) => `编码器：${n}`,
        encoderListFailed: (m) => `无法列出编码器：${m}`,
        audioEncoder: "音频编码器",
        audioEncoderAuto: "音频：自动",
        audioEncoderSwitched: (n) => `音频编码器：${n}`,
        audioEncoderWarning: (c) => `${c} 音频无法经 WebRTC 播放（仅 opus）`,
        kbdPlaceholder: "输入文字，回车发送到设备",
        send: "发送",
        emptyStage: "👆 点这里，选择设备开始镜像",
        loadingDevices: "加载设备中…",
        noBackend: "未配置后端地址",
        noBackendHint: "未配置后端 — 在网址后加 ?server=后端域名",
        backendDown: "后端连接失败",
        backendDownHint: (b) => `连不上 ${b} — 检查服务是否在线，或用 ?server= 换个地址`,
        hostError: "设备主机不可用",
        hostErrorHint: (m) => `后端在线，但获取设备失败：${m}（通常是本机 adb 未启动，先运行 adb start-server）`,
        noDevices: "无设备 — 请先 adb connect",
        noDevicesHint: "后端正常，但没有已连接的设备",
        adbConnect: "ADB 连接",
        adbHostPlaceholder: "设备 IP",
        adbPortPlaceholder: "端口",
        adbConnectBtn: "连接",
        adbConnected: "已连接，刷新设备中…",
        adbConnectFailed: (m) => `adb connect 失败：${m}`,
        selectDevice: "选择设备…",
        device: "设备",
        connecting: "连接中…",
        wsTimeout: "连接超时：信令 WebSocket 未建立 — 当前链路（如 FN Connect 中继）可能不支持 WebSocket，改用直连域名试试",
        error: (m) => `出错：${m}`,
        decodeError: (m) => `解码出错：${m}`,
        disconnected: "连接已断开",
        downshift: (p) => `网络受限，已降为${p}`,
        backendPrompt: "后端地址（scrcpy-webrtc 服务的域名，如 xxx.relay.hapi.run）：",
        shell: "设备 Shell",
        close: "关闭",
        shellExited: (c) => `会话结束，退出码 ${c}`,
        unauthorized: "认证失败",
        unauthorizedHint: "token 无效或缺失 — 用启动日志里的 ?token=… 链接打开",
        signalDown: "联系不到主机",
        signalDownHint: "确认主机正以 --signal 运行且在线，然后刷新",
        p2pFailed: "P2P 连接失败 — 在主机侧加 --turn 可解决",
        customOptions: "自定义 scrcpy 参数",
        customOptionsHint: "留空跟随画质预设；非空值会覆盖对应参数",
        optExtra: "其他参数 (键值对)",
        optAdd: "+",
        optApply: "应用",
        optReset: "重置",
        optInvalidExtra: "键值对格式错误",
        audioAutoDisabled: "设备音频不可用，已自动关闭",
        wsAudioUnsupported: "此浏览器不支持解码音频",
        disconnect: "断开连接",
        disconnectShort: "断开",
        devicesTitle: "已保存的连接",
        connectNow: "连接",
        currentConnected: "使用中",
        deleteConn: "删除此连接",
        confirmDelete: (s) => `确定删除 ${s}？`,
        noSavedDevices: "暂无已保存的连接 — 在下方输入 IP 添加",
        deviceRemoved: "已删除",
        deviceDeleteFailed: (m) => `删除失败：${m}`,
        offlineTag: "离线",
        openInBrowser: "外部浏览器",
        openInBrowserBtn: "🌐 打开并复制",
        openInBrowserHint: "用系统浏览器（Safari）打开本应用，同时复制地址备用；规避 App 内嵌页快速连点丢触摸",
        openInBrowserOpened: (u) => `已交给系统浏览器打开 ${u}（本页已切后台）— Safari 提示“此连接非私人连接”时点“查看证书”→“访问此网站”`,
        openInBrowserCopied: (u) => `未能唤起浏览器（宿主没提供 JS 桥）— 地址已复制：${u}，请在 Safari 地址栏长按粘贴访问`,
        openInBrowserIgnored: (u, d) => `请求已发出但本页仍在前台（${d}）— App 未把浏览器切上来，地址已复制：${u}，请切到 Safari 长按粘贴`,
        openInBrowserCopyFailed: (u) => `打开与复制都失败 — 请手动在 Safari 访问：${u}`,
    },
    en: {
        refresh: "Refresh devices",
        fullscreen: "Fullscreen",
        settings: "Settings",
        quality: "Quality",
        sound: "Sound",
        power: "Power",
        back: "Back",
        home: "Home",
        recents: "Recents",
        keyboard: "Keyboard",
        qAuto: "Auto",
        qLow: "Smooth",
        qMedium: "Balanced",
        qHigh: "HD",
        encoder: "Video encoder",
        encoderAuto: "Encoder: auto",
        encoderSwitched: (n) => `Encoder: ${n}`,
        encoderListFailed: (m) => `Cannot list encoders: ${m}`,
        audioEncoder: "Audio encoder",
        audioEncoderAuto: "Audio: auto",
        audioEncoderSwitched: (n) => `Audio encoder: ${n}`,
        audioEncoderWarning: (c) => `${c} audio can't play over WebRTC (opus only)`,
        kbdPlaceholder: "Type text, press Enter to send",
        send: "Send",
        emptyStage: "👆 Tap here to pick a device and start",
        loadingDevices: "Loading devices…",
        noBackend: "Backend not configured",
        noBackendHint: "No backend set — append ?server=your-domain to the URL",
        backendDown: "Backend unreachable",
        backendDownHint: (b) => `Cannot reach ${b} — check the service, or use ?server= to change it`,
        hostError: "Device host unavailable",
        hostErrorHint: (m) => `Backend is up but listing devices failed: ${m} (usually adb isn't running — try "adb start-server")`,
        noDevices: "No devices — run adb connect first",
        noDevicesHint: "Backend is up, but no devices are connected",
        adbConnect: "ADB connect",
        adbHostPlaceholder: "Device IP",
        adbPortPlaceholder: "Port",
        adbConnectBtn: "Connect",
        adbConnected: "Connected, refreshing devices…",
        adbConnectFailed: (m) => `adb connect failed: ${m}`,
        selectDevice: "Select device…",
        device: "Device",
        connecting: "Connecting…",
        wsTimeout: "Signaling timeout: the WebSocket never opened — this link (e.g. the FN Connect relay) may not carry WebSockets; try a direct-access domain",
        error: (m) => `Error: ${m}`,
        decodeError: (m) => `Decode error: ${m}`,
        disconnected: "Disconnected",
        downshift: (p) => `Network limited, switched to ${p}`,
        backendPrompt: "Backend address (your scrcpy-webrtc server's domain, e.g. xxx.relay.hapi.run):",
        shell: "Device shell",
        close: "Close",
        shellExited: (c) => `session ended, exit code ${c}`,
        unauthorized: "Unauthorized",
        unauthorizedHint: "Missing or invalid token — open the ?token=… link from the server log",
        signalDown: "Can't reach the host",
        signalDownHint: "Make sure the host is running with --signal, then refresh",
        p2pFailed: "P2P failed — add --turn on the host to fix this",
        customOptions: "Custom scrcpy options",
        customOptionsHint: "Empty fields follow the quality preset; non-empty values override",
        optExtra: "Other options (key/value)",
        optAdd: "+",
        optApply: "Apply",
        optReset: "Reset",
        optInvalidExtra: "Invalid key/value",
        audioAutoDisabled: "Device audio unavailable — auto-disabled",
        wsAudioUnsupported: "Browser can't decode audio over WS",
        disconnect: "Disconnect",
        disconnectShort: "Disconnect",
        devicesTitle: "Saved connections",
        connectNow: "Connect",
        currentConnected: "In use",
        deleteConn: "Delete this connection",
        confirmDelete: (s) => `Delete ${s}?`,
        noSavedDevices: "No saved connections — add one below by IP",
        deviceRemoved: "Removed",
        deviceDeleteFailed: (m) => `delete failed: ${m}`,
        offlineTag: "offline",
        openInBrowser: "External browser",
        openInBrowserBtn: "🌐 Open & copy",
        openInBrowserHint: "Open this app in the system browser (Safari) and copy the address as a fallback; avoids the in-app WebView dropping fast taps",
        openInBrowserOpened: (u) => `Handed ${u} to the system browser (this page went to the background) — if Safari warns "This connection is not private", tap "Show Certificate" → "Visit Website"`,
        openInBrowserCopied: (u) => `Browser did not open (no host JS bridge) — address copied: ${u}; paste it into the Safari address bar`,
        openInBrowserIgnored: (u, d) => `Request sent but this page stayed in the foreground (${d}) — the App did not bring a browser up; address copied: ${u}, paste it in Safari`,
        openInBrowserCopyFailed: (u) => `Could not open or copy — visit ${u} in Safari manually`,
    },
};

// language: ?lang= param (persisted) > saved choice > browser language
const langParam = new URLSearchParams(location.search).get("lang");
const DEBUG_AUDIO = new URLSearchParams(location.search).get("debug") === "audio";
const debugInfo = (...args) => {
    if (DEBUG_AUDIO) console.info(...args);
};
if (langParam) localStorage.setItem("scrcpy-webrtc-lang", langParam);
const LANG = (localStorage.getItem("scrcpy-webrtc-lang") || navigator.language || "en")
    .toLowerCase()
    .startsWith("zh") ? "zh" : "en";
const t = STRINGS[LANG];

// backend resolution: ?server= param > saved value > same-origin.
// lets the static page live on GitHub Pages while the backend sits
// behind a tunnel; the URL param is the only way to point it elsewhere.
const backendParam = new URLSearchParams(location.search).get("server");
if (backendParam !== null) {
    localStorage.setItem("scrcpy-webrtc-backend", backendParam.replace(/^[a-z]+:\/\//, "").replace(/\/$/, ""));
}
// serverless signaling (#k=… from a --signal host): the key stays in the
// fragment — it never reaches any server, and the page needs it on reload
const frag = new URLSearchParams(location.hash.slice(1));
const SIGNAL_KEY = frag.get("k") || "";
const SIGNAL = Boolean(SIGNAL_KEY);

// token arrives via ?token= (or #…&t= in signal links), then is scrubbed
// from the URL so it doesn't linger in history or get shared along
const tokenParam = new URLSearchParams(location.search).get("token") ?? frag.get("t");
if (tokenParam !== null) {
    localStorage.setItem("scrcpy-webrtc-token", tokenParam);
    const clean = new URL(location.href);
    clean.searchParams.delete("token");
    frag.delete("t");
    clean.hash = frag.toString();
    history.replaceState(null, "", clean);
}
const TOKEN = localStorage.getItem("scrcpy-webrtc-token") || "";

const BACKEND = localStorage.getItem("scrcpy-webrtc-backend") || "";
// Pick up the gateway prefix automatically. When opened directly the
// pathname is "/" so the prefix is empty and absolute URLs stay root-based.
// When served behind fnOS the pathname is "/app/<appname>", so we lift that
// first /app/<name> segment and prefix every API/WebSocket call with it —
// derived from the URL rather than hardcoded, so renaming the app just works.
const PREFIX = BACKEND ? "" : (location.pathname.match(/^(\/app\/[^/]+)/) || [])[1] ?? location.pathname.replace(/\/$/, "");
const HTTP_BASE = BACKEND ? `https://${BACKEND}` : PREFIX;
const WS_BASE = BACKEND
    ? `wss://${BACKEND}`
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${PREFIX}`;

// Hijack-prone in-app WebViews (iOS WKWebView without allowsInlineMediaPlayback,
// WeChat XWeb, fnOS 飞牛云 App) promote a <video> playing a WebRTC MediaStream to
// a native fullscreen player that renders it black. So keep video on the
// WebSocket <canvas> and use WebRTC only for audio + control. This doubles as the
// fix for iOS 16.4–18.x, whose WebKit has no WebCodecs AudioDecoder — the RTP
// track is decoded natively and played through WebAudio instead.
const HIJACK_WEBVIEW = (() => {
    const ua = navigator.userAgent || "";
    const bareIOSWebview = /iPhone|iPad|iPod/.test(ua)
        && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS|MxIOS/i.test(ua);
    const bareAndroidWebview = /Android/.test(ua)
        && !/Chrome|CriOS|Firefox|Edg|OPR|SamsungBrowser|HuaweiBrowser|MiuiBrowser/i.test(ua);
    const knownHijacker = /fnOS|fnClient|feiniu|fnnas|MicroMessenger|aweme|Bytedance|QQ\/|Quark/i.test(ua);
    return bareIOSWebview || bareAndroidWebview || knownHijacker;
})();
// Hybrid takes video off WebRTC and renders it on the WS <canvas>, which needs
// WebCodecs VideoDecoder. Some embedded WebViews (fnOS desktop/mobile client on
// Windows) advertise a hijacker UA yet ship without WebCodecs, and a desktop
// WebView never promotes <video> to a native player anyway — so only enter
// HYBRID when VideoDecoder is actually available, otherwise fall back to the
// WebRTC <video> path (native decode, no WebCodecs required).
const HAS_WEBCODECS = typeof VideoDecoder !== "undefined";
const HYBRID_PARAM = new URLSearchParams(location.search).get("hybrid");
const HYBRID = (HYBRID_PARAM !== null ? HYBRID_PARAM !== "0" : HIJACK_WEBVIEW) && HAS_WEBCODECS;
// iOS WebKit won't render a remote WebRTC audio track through WebAudio
// (MediaStreamAudioSourceNode → destination stays silent); it plays the same
// stream from a hidden <audio> element, which — unlike a <video> that outputs
// sound — is never promoted to the native fullscreen player.
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");

function promptBackend() {
    const input = prompt(t.backendPrompt, BACKEND);
    if (input === null) return;
    localStorage.setItem("scrcpy-webrtc-backend", input.trim().replace(/^[a-z]+:\/\//, "").replace(/\/$/, ""));
    location.reload();
}

// ── remembered session settings ──────────────────────────────────
// the host keeps device, quality, encoders and mute per connection, so every
// reload used to reset them; keeping them in the page means coming back to the
// device you were mirroring, at the quality you left it at
const SESSION_KEY = "scrcpy-webrtc-session";
const session = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
    } catch {
        return {}; // corrupt value — fall back to defaults
    }
})();

function rememberSession(patch) {
    Object.assign(session, patch);
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {} // private mode / full quota — remembering is best-effort
}

// encoder names are device-specific MediaCodec components, so they are kept
// per serial: pinning one that this device doesn't have would break its session
const savedEncoders = (serial) => (serial && session.encoders?.[serial]) || {};
function rememberEncoder(serial, patch) {
    if (serial) {
        rememberSession({ encoders: { ...session.encoders, [serial]: { ...savedEncoders(serial), ...patch } } });
    }
}

const $ = (id) => document.getElementById(id);
const selectOptions = (select) =>
    select?.tagName === "SELECT" ? Array.from(select.options || []) : [];
const deviceSelect = $("device-select");
const qualitySelect = $("quality-select");
const encoderSelect = $("encoder-select");
const audioEncoderSelect = $("audio-encoder-select");
const settingsSheet = $("settings-sheet");
const settingsBackdrop = $("settings-backdrop");
const stageEl = $("stage");
const badgeEl = $("status-badge");
const productStatusEl = $("convert-topbar-status");
const kbdBar = $("kbdbar");
const kbdInput = $("kbd-input");
const shellPanel = $("shell-panel");
const adbHostInput = $("adb-host");
const adbPortInput = $("adb-port");
const adbConnectBtn = $("adb-connect");

const PRESET_NAMES = { low: t.qLow, medium: t.qMedium, high: t.qHigh };

// apply translations to the static page
document.documentElement.lang = LANG;
for (const [id, key] of [
    ["refresh", "refresh"], ["btn-fullscreen", "fullscreen"],
    ["quality-select", "quality"], ["encoder-select", "encoder"],
    ["audio-encoder-select", "audioEncoder"],
    ["btn-mute", "sound"], ["btn-power", "power"],
    ["btn-back", "back"], ["btn-home", "home"], ["btn-recents", "recents"], ["btn-kbd", "keyboard"],
    ["btn-shell", "shell"], ["shell-close", "close"],
    ["btn-settings", "settings"], ["settings-close", "close"],
    ["btn-disconnect", "disconnect"],
]) $(id).title = t[key];
// the settings sheet labels its rows in text rather than tooltips
for (const [id, key] of [
    ["settings-title", "settings"], ["label-device", "devicesTitle"],
    ["label-adb-connect", "adbConnect"],
    ["label-quality", "quality"],
    ["label-encoder", "encoder"], ["label-audio-encoder", "audioEncoder"],
    ["label-sound", "sound"], ["label-fullscreen", "fullscreen"],
    ["label-power", "power"], ["label-back", "back"], ["label-home", "home"],
    ["label-recents", "recents"], ["label-kbd", "keyboard"], ["label-shell", "shell"],
    ["label-disconnect", "disconnectShort"],
    ["label-custom-options", "customOptions"], ["label-opt-extra", "optExtra"],
    ["label-open-browser", "openInBrowser"],
]) $(id).textContent = t[key];
$("opt-extra-add").textContent = t.optAdd;
$("opt-apply").textContent = t.optApply;
$("opt-reset").textContent = t.optReset;
for (const opt of selectOptions(qualitySelect)) {
    opt.textContent = { auto: t.qAuto, low: t.qLow, medium: t.qMedium, high: t.qHigh }[opt.value];
}

// ── video encoder picker ───────────────────────────────────────
// the list comes from the host (scrcpy-server --list-encoders); the select
// stays hidden until one arrives, so the bar is unchanged on older hosts
function resetEncoderOptions() {
    encoderSelect.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "";
    auto.textContent = t.encoderAuto;
    encoderSelect.appendChild(auto);
    encoderSelect.value = "";
    encoderSelect.title = t.encoder;
    encoderSelect.hidden = true;
}

function fillEncoders(list, current) {
    const wanted = current || encoderSelect.value;
    resetEncoderOptions();
    for (const e of list) {
        if (e.type && e.type !== "video") continue;
        const opt = document.createElement("option");
        opt.value = e.name;
        opt.textContent = e.name;
        opt.title = [e.name, e.codec, e.hardwareType].filter(Boolean).join(" · ");
        encoderSelect.appendChild(opt);
    }
    // a host-side --video-encoder pin may not be in the device's own list
    if (wanted && !selectOptions(encoderSelect).some((o) => o.value === wanted)) {
        const opt = document.createElement("option");
        opt.value = wanted;
        opt.textContent = wanted;
        encoderSelect.appendChild(opt);
    }
    encoderSelect.value = wanted;
    encoderSelect.hidden = encoderSelect.options.length < 2;
    syncCustomEncoderOptions("opt-video-encoder", encoderSelect);
}

// the host reports the encoder the device actually opened, which can differ
// from what was asked for — surfacing it makes a silent fallback visible
function setActiveEncoder(name) {
    const auto = encoderSelect.options[0];
    if (!auto) return;
    auto.textContent = name ? `${t.encoderAuto} · ${name}` : t.encoderAuto;
}

// ── audio encoder picker ───────────────────────────────────────
// the same device list, filtered to its audio half. The WebRTC audio track
// only carries opus, so other codecs are labelled rather than hidden: seeing
// what the device offers beats wondering why it is missing
function resetAudioEncoderOptions() {
    audioEncoderSelect.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "";
    auto.textContent = t.audioEncoderAuto;
    audioEncoderSelect.appendChild(auto);
    audioEncoderSelect.value = "";
    audioEncoderSelect.title = t.audioEncoder;
    audioEncoderSelect.hidden = true;
}

function fillAudioEncoders(list, current) {
    const wanted = current || audioEncoderSelect.value;
    resetAudioEncoderOptions();
    for (const e of list) {
        if (e.type !== "audio") continue;
        const opt = document.createElement("option");
        opt.value = e.name;
        opt.dataset.codec = e.codec ?? "";
        opt.textContent = e.codec && e.codec !== "opus" ? `${e.name} (${e.codec})` : e.name;
        opt.title = [e.name, e.codec, e.hardwareType].filter(Boolean).join(" · ");
        audioEncoderSelect.appendChild(opt);
    }
    if (wanted && !selectOptions(audioEncoderSelect).some((o) => o.value === wanted)) {
        const opt = document.createElement("option");
        opt.value = wanted;
        opt.textContent = wanted;
        audioEncoderSelect.appendChild(opt);
    }
    audioEncoderSelect.value = wanted;
    audioEncoderSelect.hidden = audioEncoderSelect.options.length < 2;
    syncCustomEncoderOptions("opt-audio-encoder", audioEncoderSelect);
}

function setActiveAudioEncoder(name) {
    const auto = audioEncoderSelect.options[0];
    if (!auto) return;
    auto.textContent = name ? `${t.audioEncoderAuto} · ${name}` : t.audioEncoderAuto;
}

resetEncoderOptions();
resetAudioEncoderOptions();
// show the remembered preset before anything is even connected
if (selectOptions(qualitySelect).some((o) => o.value === session.quality)) {
    qualitySelect.value = session.quality;
}
kbdInput.placeholder = t.kbdPlaceholder;
$("kbd-send").textContent = t.send;
stageEl.dataset.emptyHint = t.emptyStage;
adbHostInput.placeholder = t.adbHostPlaceholder;
adbPortInput.placeholder = t.adbPortPlaceholder;
adbConnectBtn.textContent = t.adbConnectBtn;
if (session.adbHost) adbHostInput.value = session.adbHost;
if (session.adbPort) adbPortInput.value = String(session.adbPort);
if (SIGNAL) {
    // serverless signaling 没有本地后端，adb connect 功能不可用
    adbHostInput.disabled = true;
    adbPortInput.disabled = true;
    adbConnectBtn.disabled = true;
    adbConnectBtn.title = "Serverless signaling 模式下不可用";
}

let ws = null;
let wsTimer = null;
let decoder = null;
let writer = null;
let canvas = null;
let currentSerial = null;
// last /api/devices payload, kept so the sheet can re-paint active/online
// state every time it opens or the session drops — without refetching.
let lastDevices = [];

let pc = null;
let dc = null;
let shellDc = null;
let videoEl = null;
let path = "ws"; // "ws" | "rtc"
let statsTimer = null;
let lastSize = "";
// always start muted on a fresh page load — autoplay policy would otherwise
// reject the first audio.play() with NotAllowedError, and silent-by-default
// matches what most users want anyway
// The product shell opens a phone from a real user gesture. Start the browser
// path with audio on; the product-level audio action can mute it explicitly.
let muted = false;
// whether the device should send an audio track at all — separate from
// browser-side muted. Some Android devices (notably redroid on 13+) ship an
// opus encoder that crashes on start; turning this off skips audio entirely.
let audioEnabled = true;
let lastClipFromDevice = null;
let lastClipToDevice = null;

// ── WS-path audio (opus over the control WebSocket) ─────────────
// Audio normally rides the WebRTC track; on the WS fallback path it arrives
// as tagged binary frames (tag 2, same 10-byte header as video) and is
// decoded with WebCodecs and scheduled through an AudioContext. Suspended
// until the first unmute tap so autoplay policy is satisfied.
let audioCtx = null;
let audioGain = null;
let audioDecoder = null;
let audioSinkTime = 0;
let wsAudioEnabled = true;
let wsAudioPackets = 0;
let wsAudioChunks = 0;
// set when AudioDecoder is missing or rejects the opus codec — keeps the
// tag-2 packet handler from retrying on every frame
let audioDecoderFailed = false;

function ensureAudioDecoder() {
    if (audioDecoder || audioDecoderFailed) return;
    if (typeof AudioDecoder === "undefined") {
        audioDecoderFailed = true;
        console.warn("ws audio: AudioDecoder unavailable in this browser");
        setBadge(t.wsAudioUnsupported, "warn");
        return;
    }
    audioDecoder = new AudioDecoder({
        output: (chunk) => {
            wsAudioChunks++;
            if (wsAudioChunks === 1) debugInfo("ws audio: first decoded chunk", chunk.numberOfFrames, chunk.sampleRate);
            scheduleAudioChunk(chunk);
        },
        error: (e) => console.warn("ws audio decode error:", e?.message ?? e),
    });
    try {
        // scrcpy's opus stream is 48 kHz stereo; frames arrive one per packet
        audioDecoder.configure({ codec: "opus", sampleRate: 48000, numberOfChannels: 2 });
        debugInfo("ws audio: AudioDecoder configured");
    } catch (e) {
        audioDecoderFailed = true;
        console.warn("ws audio: opus not supported by AudioDecoder:", e?.message ?? e);
        setBadge(t.wsAudioUnsupported, "warn");
        try { audioDecoder.close(); } catch {}
        audioDecoder = null;
    }
}

function scheduleAudioChunk(audioData) {
    try {
        ensureAudioGraph();
        if (wsAudioChunks === 1) debugInfo("ws audio: playback state", {
            muted,
            context: audioCtx?.state,
            gain: audioGain?.gain?.value,
            destination: audioCtx?.destination?.maxChannelCount,
        });
        // muted: still decode to keep the pipeline warm, but never schedule
        if (muted) return;
        if (audioCtx.state !== "running") {
            // couldn't resume yet (no user gesture) — try once more from this
            // callback; if that fails too, drop this chunk so we don't pile
            // up a multi-second lead that would play out as a laggy blast
            audioCtx.resume().catch(() => {});
            if (audioCtx.state !== "running") return;
        }
        const frameCount = audioData.numberOfFrames;
        const channels = audioData.numberOfChannels;
        const buffer = audioCtx.createBuffer(channels, frameCount, audioData.sampleRate);
        for (let c = 0; c < channels; c++) {
            const plane = new Float32Array(frameCount);
            audioData.copyTo(plane, { planeIndex: c, format: "f32-planar" });
            if (wsAudioChunks === 1 || wsAudioChunks % 100 === 0) {
                let peak = 0;
                for (const sample of plane) peak = Math.max(peak, Math.abs(sample));
                debugInfo("ws audio: decoded PCM peak", { chunk: wsAudioChunks, peak });
            }
            buffer.copyToChannel(plane, c);
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(audioGain);
        // pace by arrival; keep a small safety delay and never run into the past
        audioSinkTime = Math.max(audioSinkTime, audioCtx.currentTime + 0.03);
        // if a long stall let the lead balloon (e.g. tab backgrounded), snap
        // back so the stream catches up instead of playing in slow motion
        if (audioSinkTime - audioCtx.currentTime > 0.5) audioSinkTime = audioCtx.currentTime + 0.03;
        src.start(audioSinkTime);
        audioSinkTime += frameCount / audioData.sampleRate;
    } catch (e) {
        console.warn("ws audio play error:", e?.message ?? e);
    } finally {
        audioData.close();
    }
}

function teardownWsAudio() {
    try { audioDecoder?.close(); } catch {}
    audioDecoder = null;
    audioSinkTime = 0;
    wsAudioEnabled = true;
}

// ---- RTP audio via WebAudio ------------------------------------------------
// The <video> element must stay muted (iOS would otherwise present its native
// fullscreen player the moment it outputs sound). The remote audio track is
// therefore pumped through an AudioContext graph that feeds the same audioGain
// node the WS path uses, so the 🔊 toggle controls both paths identically.
let rtcAudio = null; // { src, stream }
let rtcAudioEl = null; // hidden <audio> used to play the RTP track on iOS
let rtcAudioUnlock = null;

function ensureAudioGraph() {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioGain ??= (() => {
        const g = audioCtx.createGain();
        g.connect(audioCtx.destination);
        return g;
    })();
    audioGain.gain.value = muted ? 0 : 1;
}

function setupRtcAudio(track) {
    if (track.kind !== "audio") return;
    teardownRtcAudio();
    const stream = new MediaStream([track]);
    // Use a real audio element for the remote WebRTC track. This is the
    // playback path used by the reference CloudPhone client and is more
    // reliable across Chromium/WebView autoplay and MediaStream policies
    // than routing the track through MediaStreamAudioSourceNode.
    rtcAudioEl = document.createElement("audio");
    rtcAudioEl.srcObject = stream;
    rtcAudioEl.autoplay = true;
    rtcAudioEl.playsInline = true;
    rtcAudioEl.muted = muted;
    rtcAudioEl.volume = 1;
    rtcAudioEl.style.display = "none";
    document.body.appendChild(rtcAudioEl);
    const retry = () => {
        if (!rtcAudioEl) return;
        rtcAudioEl.play().then(() => {
            if (rtcAudioUnlock) {
                for (const event of ["pointerdown", "keydown", "touchstart", "click"]) {
                    window.removeEventListener(event, rtcAudioUnlock, { capture: true });
                }
                rtcAudioUnlock = null;
            }
        }).catch((e) => console.warn("rtc audio play blocked:", e?.message ?? e));
    };
    rtcAudioUnlock = retry;
    for (const event of ["pointerdown", "keydown", "touchstart", "click"]) {
        window.addEventListener(event, retry, { once: true, capture: true });
    }
    retry();
    track.addEventListener?.("ended", teardownRtcAudio, { once: true });
}

function teardownRtcAudio() {
    if (rtcAudioUnlock) {
        for (const event of ["pointerdown", "keydown", "touchstart", "click"]) {
            window.removeEventListener(event, rtcAudioUnlock, { capture: true });
        }
        rtcAudioUnlock = null;
    }
    try { rtcAudio?.src.disconnect(); } catch {}
    rtcAudio = null;
    if (rtcAudioEl) {
        try { rtcAudioEl.pause(); rtcAudioEl.srcObject = null; rtcAudioEl.remove(); } catch {}
        rtcAudioEl = null;
    }
}

function setBadge(text, cls = "") {
    badgeEl.hidden = !text;
    badgeEl.textContent = text;
    badgeEl.className = cls;
    if (productStatusEl) productStatusEl.textContent = text || (currentSerial ? "Dispositivo conectado" : "Aguardando dispositivo");
    window.dispatchEvent(new CustomEvent("convert-phone:session", { detail: { serial: currentSerial || "", status: text || (currentSerial ? "Dispositivo conectado" : "Aguardando dispositivo") } }));
}

async function loadDevices() {
    const placeholder = (text) => {
        deviceSelect.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = text;
        deviceSelect.appendChild(opt);
    };
    placeholder(t.loadingDevices);
    let devices = [];
    if (SIGNAL) {
        try {
            devices = await signalDevices();
        } catch (e) {
            if (e.message === "unauthorized") {
                placeholder(t.unauthorized);
                setBadge(t.unauthorizedHint, "error");
            } else {
                placeholder(t.signalDown);
                setBadge(t.signalDownHint, "error");
            }
            return;
        }
    } else {
        let res;
        try {
            res = await fetch(`${HTTP_BASE}/api/devices`, {
                headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
            });
        } catch {
            // fetch itself rejected: the backend host is unreachable — either
            // no backend was ever configured (static hosting) or the configured
            // one is down. Only here does asking for a backend address make sense.
            if (!BACKEND) {
                placeholder(t.noBackend);
                setBadge(t.noBackendHint, "error");
                promptBackend();
            } else {
                placeholder(t.backendDown);
                setBadge(t.backendDownHint(BACKEND), "error");
            }
            return;
        }
        if (res.status === 401) {
            placeholder(t.unauthorized);
            setBadge(t.unauthorizedHint, "error");
            return;
        }
        if (!res.ok) {
            // the server answered but errored (usually the adb host isn't
            // reachable / no device host). Surface the real cause instead of a
            // misleading "configure your backend" prompt — the backend is fine.
            const body = await res.json().catch(() => ({}));
            placeholder(t.hostError);
            setBadge(t.hostErrorHint(body.error || `HTTP ${res.status}`), "error");
            return;
        }
        devices = await res.json();
    }
    if (devices.length === 0) {
        placeholder(t.noDevices);
        setBadge(t.noDevicesHint, "error");
        renderDeviceList([]);
        window.__convertPhoneDevices = [];
        window.dispatchEvent(new CustomEvent("convert-phone:devices", { detail: { devices: [] } }));
        return;
    }
    setBadge("");
    placeholder(t.selectDevice);
    for (const d of devices) {
        const opt = document.createElement("option");
        opt.value = d.serial;
        opt.textContent = `${d.model?.replaceAll("_", " ") ?? d.product ?? t.device} · ${d.serial}`;
        deviceSelect.appendChild(opt);
    }
    // render an explicit device list — no auto-connect. on phones the user
    // must tap a device (row or 连接) before its screen appears.
    renderDeviceList(devices);
    window.__convertPhoneDevices = devices;
    window.dispatchEvent(new CustomEvent("convert-phone:devices", { detail: { devices } }));
}

// build the tappable saved-connection rows inside the sheet. each row shows an
// online/offline dot, name + serial, and carries a 连接 / 删除 pair; tapping the
// row itself connects, so the phone-sized tap target isn't a tiny button.
function renderDeviceList(devices) {
    lastDevices = devices || [];
    const list = $("device-list");
    if (!list) return;
    list.innerHTML = "";
    if (!lastDevices.length) {
        const empty = document.createElement("div");
        empty.className = "device-empty";
        empty.textContent = t.noSavedDevices;
        list.appendChild(empty);
        return;
    }
    for (const d of lastDevices) {
        const isActive = d.serial === currentSerial;
        const row = document.createElement("div");
        row.className = "device-item" + (isActive ? " active" : "") + (d.offline ? " offline" : "");
        const dot = document.createElement("span");
        dot.className = "device-dot";
        const info = document.createElement("div");
        info.className = "device-info";
        const name = document.createElement("span");
        name.className = "device-name";
        name.textContent = d.model?.replaceAll("_", " ") || d.product || t.device;
        const addr = document.createElement("small");
        addr.className = "device-addr";
        addr.textContent = `${d.serial}${d.offline ? " · " + t.offlineTag : ""}`;
        info.append(name, addr);
        const actions = document.createElement("div");
        actions.className = "device-actions";
        const conn = document.createElement("button");
        conn.type = "button";
        conn.className = "mini device-connect" + (isActive ? " on" : "");
        conn.textContent = isActive ? t.currentConnected : t.connectNow;
        conn.addEventListener("pointerdown", (e) => e.preventDefault());
        conn.onclick = (e) => { e.stopPropagation(); if (!isActive) { connect(d.serial); setSettingsOpen(false); } };
        const del = document.createElement("button");
        del.type = "button";
        del.className = "mini device-del";
        del.title = t.deleteConn;
        del.setAttribute("aria-label", t.deleteConn);
        del.textContent = "✕";
        del.addEventListener("pointerdown", (e) => e.preventDefault());
        del.onclick = (e) => { e.stopPropagation(); removeDevice(d.serial); };
        actions.append(conn, del);
        row.append(dot, info, actions);
        row.onclick = () => { if (!isActive) { connect(d.serial); setSettingsOpen(false); } };
        list.appendChild(row);
    }
}

async function removeDevice(serial) {
    if (!confirm(t.confirmDelete(serial))) return;
    try {
        const res = await fetch(
            `${HTTP_BASE}/api/adb-disconnect?serial=${encodeURIComponent(serial)}`,
            { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} },
        );
        if (res.status === 401) { setBadge(t.unauthorizedHint, "error"); return; }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (currentSerial === serial) disconnect();
        // the removed row vanishing IS the confirmation; a toast badge would
        // sit behind the open sheet anyway.
        await loadDevices();
    } catch (e) {
        setBadge(t.deviceDeleteFailed(e.message), "error");
    }
}

// ---- serverless signaling (--signal hosts) --------------------------------
// The room replaces both /api/devices and the /api/stream WebSocket with
// encrypted messages on public MQTT brokers, addressed per-session by sid.
// There is no WS video fallback on this path — media is WebRTC-only.

let signalRoom = null;
let roomPromise = null;
const signalRoutes = new Map(); // sid -> handler

function ensureRoom() {
    roomPromise ??= SignalRoom.create({ key: b64u.decode(SIGNAL_KEY), role: "viewer" }).then((room) => {
        signalRoom = room;
        room.onmessage = (msg) => signalRoutes.get(msg.sid)?.(msg);
        return room;
    });
    return roomPromise;
}

const randSid = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

async function signalDevices() {
    await ensureRoom();
    const sid = randSid();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signalRoutes.delete(sid);
            reject(new Error("timeout"));
        }, 12000);
        signalRoutes.set(sid, (msg) => {
            clearTimeout(timer);
            signalRoutes.delete(sid);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.devices ?? []);
        });
        signalRoom.send({ sid, t: "devices", token: TOKEN || undefined });
    });
}

// quacks like the WebSocket connect() expects: send/close/onopen/onmessage/
// onclose/readyState — so the whole session protocol runs unchanged
function signalChannel(serial) {
    const sid = randSid();
    let hb = null;
    const chan = {
        readyState: WebSocket.CONNECTING,
        binaryType: "",
        onopen: null,
        onmessage: null,
        onclose: null,
        send(s) {
            signalRoom?.send({ sid, ...JSON.parse(s) });
        },
        close() {
            if (chan.readyState === WebSocket.OPEN) signalRoom?.send({ sid, t: "bye" });
            chan.readyState = WebSocket.CLOSED;
            clearInterval(hb);
            signalRoutes.delete(sid);
        },
    };
    ensureRoom().then(() => {
        if (chan.readyState === WebSocket.CLOSED) return;
        signalRoutes.set(sid, (msg) => {
            if (msg.t === "bye") {
                const wasOpen = chan.readyState === WebSocket.OPEN;
                chan.readyState = WebSocket.CLOSED;
                clearInterval(hb);
                signalRoutes.delete(sid);
                if (wasOpen) chan.onclose?.({ code: msg.code ?? 1000 });
            } else {
                chan.onmessage?.({ data: JSON.stringify(msg) });
            }
        });
        signalRoom.send({ sid, t: "open", serial, token: TOKEN || undefined });
        // brokers give no liveness signal for the peer; the host times a
        // session out after 90 s without traffic, so keep it warm
        hb = setInterval(() => signalRoom.send({ sid, t: "ping" }), 25000);
        chan.readyState = WebSocket.OPEN;
        chan.onopen?.();
    }).catch(() => {
        setBadge(t.signalDownHint, "error");
    });
    return chan;
}

function sendWs(obj) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}


function sendControl(obj) {
    const viaDc = dc?.readyState === "open";
    if (viaDc) dc.send(JSON.stringify(obj));
    else sendWs(obj);
}

function playVideoSafely(element = videoEl) {
    if (!element || element !== videoEl || !element.isConnected || !element.srcObject) return;
    Promise.resolve(element.play()).catch((err) => {
        if (err?.name === "AbortError" || element !== videoEl || !element.isConnected) return;
        console.warn("video.play() rejected:", err);
    });
}

function teardownRtc() {
    clearInterval(statsTimer);
    statsTimer = null;
    dc = null;
    shellDc = null;
    pc?.close();
    pc = null;
    videoEl?.remove();
    videoEl = null;
    // back to the WS path — its audio pipeline takes over again
    wsAudioEnabled = true;
    teardownRtcAudio();
    if (path === "rtc") {
        path = "ws";
        if (canvas) canvas.style.display = "";
        sendWs({ t: "video-path", mode: "ws" });
        setBadge(`${lastSize} · WS`);
        // the rotated view lost its <video> — re-adopt the canvas
        autoRotate();
    }
}

function disconnect() {
    // close any in-flight drag before the socket dies — otherwise the peer
    // is left holding a phantom finger until the scrcpy session times out
    releaseActiveTouch?.();
    releaseActiveTouch = null;
    teardownRtc();
    resetEncoderOptions();
    resetAudioEncoderOptions();
    clearTimeout(wsTimer);
    ws?.close();
    ws = null;
    writer?.releaseLock();
    writer = null;
    decoder?.dispose();
    decoder = null;
    canvas = null;
    currentSerial = null;
    path = "ws";
    teardownWsAudio();
    // keep the AudioContext alive (sources are torn down above anyway) so a
    // later reconnect does not need another tap on 🔊 to get sound back
    audioCtx?.resume().catch(() => {});
    // drop the previous stream's geometry too, so the next connection starts
    // from a clean slate instead of inheriting a stale orientation
    streamW = 0;
    streamH = 0;
    viewRotation = 0;
    paintRotateButton();
    stageEl.innerHTML = "";
    setBadge("");
    paintDisconnect();
    renderDeviceList(lastDevices);
}

// the host reads quality and encoders when it builds a session, so replaying
// the saved choices on open costs nothing — no mid-session restart
function restoreSession(serial) {
    if (session.quality) sendWs({ t: "quality", preset: session.quality });
    const enc = savedEncoders(serial);
    if (enc.video) sendWs({ t: "encoder", name: enc.video });
    if (enc.audio) sendWs({ t: "audio-encoder", name: enc.audio, codec: enc.audioCodec ?? "" });
    if (session.customOptions) {
        const opts = { ...session.customOptions };
        // Audio is controlled by the product shell now. Do not resurrect an
        // old settings-sheet value of audio:false from local session state.
        if (audioEnabled) delete opts.audio;
        sendWs({ t: "options", options: opts });
    }
}

function connect(serial) {
    disconnect();
    currentSerial = serial;
    paintDisconnect();
    rememberSession({ serial });
    setBadge(t.connecting);
    if (SIGNAL) {
        ws = signalChannel(serial);
    } else {
        const url = `${WS_BASE}/api/stream?serial=${encodeURIComponent(serial)}`;
        ws = TOKEN ? new WebSocket(url, [`scrcpy-webrtc.token.${TOKEN}`]) : new WebSocket(url);
    }
    ws.binaryType = "arraybuffer";
    // handshake watchdog: a relay/gateway that doesn't support the WebSocket
    // upgrade swallows the request — the socket sits in CONNECTING forever
    // and "连接中…" never resolves. Say so after 10 s instead.
    clearTimeout(wsTimer);
    wsTimer = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
            setBadge(t.wsTimeout, "error");
        }
    }, 10000);
    ws.onopen = () => {
        clearTimeout(wsTimer);
        // negotiate WebRTC immediately, in parallel with scrcpy startup
        tryWebRtc();
        restoreSession(serial);
    };

    ws.onmessage = async (ev) => {
        if (typeof ev.data === "string") {
            const msg = JSON.parse(ev.data);
            if (msg.type === "meta") {
                // may legitimately be 0 until the first configuration packet
                // is parsed — the follow-up "size" message carries it then
                streamW = msg.width || 0;
                streamH = msg.height || 0;
                try {
                    startDecoder(msg.codec);
                } catch (e) {
                    console.error("video decoder initialization failed:", e);
                    setBadge(t.decodeError(e.message), "error");
                    return;
                }
                $("btn-shell").hidden = !msg.shell;
                if (msg.preset) qualitySelect.value = msg.auto ? "auto" : msg.preset;
                if (path !== "rtc") setBadge("WS");
                // the server only sets audio=false when it had to auto-disable
                // it after the device's codec crashed; reflect that in the UI
                if (msg.audio === false) {
                    audioEnabled = false;
                    rememberSession({ audioEnabled });
                    paintSoundButton();
                    setBadge(t.audioAutoDisabled, "warn");
                }
                sendWs({ t: "encoder", list: true }); // this device's encoders
            } else if (msg.type === "encoders") {
                if (msg.error) setBadge(t.encoderListFailed(msg.error), "error");
                else {
                    fillEncoders(msg.list ?? [], msg.current ?? "");
                    fillAudioEncoders(msg.list ?? [], msg.currentAudio ?? "");
                }
            } else if (msg.type === "encoder") {
                setActiveEncoder(msg.name);
                if (!msg.active) setBadge(t.encoderSwitched(msg.name || t.qAuto));
            } else if (msg.type === "audio-encoder") {
                setActiveAudioEncoder(msg.name);
                // a codec the audio track can't decode is worth saying out loud
                if (!msg.active) {
                    setBadge(msg.codec && msg.codec !== "opus"
                        ? t.audioEncoderWarning(msg.codec)
                        : t.audioEncoderSwitched(msg.name || t.qAuto));
                }
            } else if (msg.type === "quality") {
                // server auto-downshifted under congestion
                setBadge(t.downshift(PRESET_NAMES[msg.preset] ?? msg.preset), "p2p");
            } else if (msg.type === "clipboard") {
                lastClipFromDevice = msg.text;
                navigator.clipboard?.writeText(msg.text).catch(() => {});
            } else if (msg.type === "size") {
                streamW = msg.width;
                streamH = msg.height;
                lastSize = `${msg.width}×${msg.height}`;
                if (path !== "rtc") setBadge(`${lastSize} · WS`);
                // stream rotated — re-run the follow rule
                autoRotate();
            } else if (msg.type === "error") {
                setBadge(t.error(msg.message), "error");
            } else if (msg.t === "rtc-offer") {
                acceptRtcOffer(msg.sdp, msg.iceServers).catch((e) => {
                    console.warn("webrtc setup failed:", e);
                    teardownRtc();
                });
            } else if (msg.t === "rtc-ice") {
                pc?.addIceCandidate(msg.candidate).catch(() => {});
            } else if (msg.t?.startsWith("shell-")) {
                handleShellMessage(msg);
            }
            return;
        }
        if (!writer) return;
        const buf = new Uint8Array(ev.data);
        const tag = buf[0];
        if (tag === 2) {
            // audio frame on the WS path: tag(1) + reserved(1) + pts(8) + opus
            if (!wsAudioEnabled) return;
            if (audioDecoderFailed) return;
            wsAudioPackets++;
            if (wsAudioPackets === 1) debugInfo("ws audio: first Opus packet", buf.length - 10, "bytes");
            else if (wsAudioPackets % 500 === 0) debugInfo("ws audio: packets", wsAudioPackets);
            ensureAudioDecoder();
            if (audioDecoder && audioDecoder.state === "configured") {
                const pts = new DataView(ev.data).getBigUint64(2);
                audioDecoder.decode(new EncodedAudioChunk({
                    type: "key",
                    timestamp: Number(pts) / 1000, // µs → ms-ish; only monotonicity matters here
                    data: buf.subarray(10),
                }));
            }
            return;
        }
        const dv = new DataView(ev.data);
        const data = buf.subarray(10);
        const packet = buf[0] === 0
            ? { type: "configuration", data }
            : { type: "data", keyframe: buf[1] === 1, pts: dv.getBigUint64(2), data };
        try {
            await writer.write(packet);
        } catch (e) {
            setBadge(t.decodeError(e.message), "error");
        }
    };
    ws.onclose = (e) => {
        clearTimeout(wsTimer);
        if (currentSerial !== serial) return;
        setBadge(e.code === 4001 ? t.unauthorizedHint : t.disconnected, "error");
        // the socket died on its own — reflect it in the sheet: drop the
        // "使用中" highlight so the same device is one tap to reconnect.
        currentSerial = null;
        paintDisconnect();
        renderDeviceList(lastDevices);
    };
}

function startDecoder(codec) {
    // No WebCodecs (e.g. fnOS's bundled WebView): skip the WS canvas entirely so
    // the meta handler doesn't throw and WebRTC's <video> can carry the picture.
    if (!HAS_WEBCODECS) {
        console.warn("WS video unavailable: WebCodecs VideoDecoder is not defined; relying on WebRTC");
        return;
    }
    const codecId = typeof codec === "string"
        ? ({
            h264: ScrcpyVideoCodecId.H264,
            h265: ScrcpyVideoCodecId.H265,
            av1: ScrcpyVideoCodecId.AV1,
        })[codec.toLowerCase()]
        : codec;
    if (!Object.values(ScrcpyVideoCodecId).includes(codecId)) {
        throw new Error(`Unsupported video codec: ${codec}`);
    }
    let renderer;
    try {
        renderer = new WebGLVideoFrameRenderer();
    } catch {
        renderer = new BitmapVideoFrameRenderer();
    }
    decoder = new WebCodecsVideoDecoder({ codec: codecId, renderer });
    writer = decoder.writable.getWriter();

    // replace only the previous canvas — the WebRTC <video> may already be
    // in the stage (negotiation runs in parallel with scrcpy startup)
    canvas?.remove();
    canvas = renderer.canvas;
    canvas.className = "screen";
    // a quality change restarts the stream mid-session; if P2P is already
    // showing, the fresh canvas must stay hidden underneath
    if (path === "rtc") canvas.style.display = "none";
    stageEl.appendChild(canvas);
    // a rotated view must adopt the fresh canvas (the old one was removed)
    autoRotate();
    attachInput(canvas);
}

function tryWebRtc() {
    if (typeof RTCPeerConnection === "undefined") {
        if (SIGNAL) setBadge(t.p2pFailed, "error");
        return;
    }
    // Hybrid mode takes audio off the WebSocket (iOS < 26 has no WebCodecs
    // AudioDecoder) and plays it from the RTP track; stop the tag-2 handler
    // from chasing an unavailable decoder and flashing "不支持解码音频".
    if (HYBRID) wsAudioEnabled = false;
    sendWs({ t: "rtc-start" });
}

async function acceptRtcOffer(sdp, extraIce) {
    pc = new RTCPeerConnection({ iceServers: [...ICE_SERVERS, ...(extraIce ?? [])] });
    globalThis.__scrcpyPc = pc;
    debugInfo("scrcpy WebRTC peer connection created", pc);
    pc.onicecandidate = (e) => {
        if (e.candidate) sendWs({ t: "rtc-ice", candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
        if (pc && ["failed", "disconnected", "closed"].includes(pc.connectionState)) {
            teardownRtc();
        }
    };
    pc.ondatachannel = (e) => {
        if (e.channel.label === "shell") {
            shellDc = e.channel;
            shellDc.onmessage = (m) => handleShellMessage(JSON.parse(m.data));
        } else {
            dc = e.channel;
        }
    };
    pc.ontrack = (e) => {
        debugInfo("scrcpy WebRTC ontrack", e.track.kind, e.track.id, e.streams?.length ?? 0);
        // minimize receive-side latency where supported
        try {
            e.receiver.playoutDelayHint = 0;
            e.receiver.jitterBufferTarget = 0;
        } catch {}
        // Hybrid mode: never build a <video> (the WebView would promote it to a
        // native player and show black). Video comes from the WS canvas; the only
        // track consumed from WebRTC here is audio, via WebAudio.
        if (HYBRID) {
            if (e.track.kind === "audio") setupRtcAudio(e.track);
            return;
        }
        // Both audio and video tracks attach to the same <video> element.
        // Rationale: Chrome's autoplay policy treats <video> and <audio>
        // elements differently. A muted <video> element is always allowed
        // to autoplay, but a muted <audio> element with a WebRTC MediaStream
        // can still reject play() with NotAllowedError on some versions.
        // Routing audio through <video> lets the autoplay exemption apply
        // uniformly across browsers.
        if (!videoEl) {
            videoEl = document.createElement("video");
            videoEl.className = "screen-video";
            videoEl.autoplay = true;
            // iOS hijacks any <video> that outputs sound into its native
            // fullscreen player, and dismissing that player leaves the
            // element half-dead. Keep the element permanently muted and
            // route RTP audio through WebAudio instead (setupRtcAudio).
            videoEl.muted = true;
            videoEl.defaultMuted = true;
            videoEl.setAttribute("muted", "");
            videoEl.playsInline = true;
            // iOS Safari only honors the *attribute* in some WebViews
            videoEl.setAttribute("playsinline", "");
            videoEl.setAttribute("webkit-playsinline", "");
            videoEl.srcObject = new MediaStream();
            stageEl.appendChild(videoEl);
            attachInput(videoEl);
            autoRotate();
            watchRtcStats();
            // fires as soon as the track's dimensions change (device rotated),
            // earlier than the server-side sizeChanged round-trip
            videoEl.addEventListener("resize", autoRotate);
        }
        videoEl.srcObject.addTrack(e.track);
        setupRtcAudio(e.track);
        playVideoSafely(videoEl);
    };
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendWs({ t: "rtc-answer", sdp: answer.sdp });
    if (HYBRID) {
        // we render the WS canvas, so tell the host to stop pushing video over
        // WebRTC — only audio (and the control DataChannel) ride P2P here
        sendWs({ t: "rtc-video", enabled: false });
        setBadge(`${lastSize} · WS画面 + P2P音频`);
    }
}

// switch paths based on real decode progress from getStats(); keeps a live
// readout in the status badge so failures are diagnosable
function watchRtcStats() {
    let lastFrames = 0;
    let lastTime = performance.now();
    let ticksWithoutDecode = 0;
    clearInterval(statsTimer);
    statsTimer = setInterval(async () => {
        if (!pc) return;
        const stats = await pc.getStats();
        let inbound = null;
        stats.forEach((s) => {
            if (s.type === "inbound-rtp" && s.kind === "video") inbound = s;
        });
        if (!inbound) return;
        const { packetsReceived = 0, framesDecoded = 0, framesReceived = 0, pliCount = 0 } = inbound;
        if (path !== "rtc") {
            if (framesDecoded > 0 && videoEl) {
                // Mobile WebViews (WeChat XWeb in particular) reject
                // programmatic play() without a user gesture. Only take over
                // the stage once the <video> is actually playing; meanwhile
                // retry every tick — any tap on the stage (attachInput)
                // doubles as the gesture that unlocks it, and the WS canvas
                // stays visible as the fallback.
                if (videoEl.paused) {
                    videoEl.play?.().catch(() => {});
                    // Some WebViews (iOS XWeb, in particular) refuse to start a
                    // MediaStream <video> until a real user gesture has happened
                    // on the page. Keep retrying indefinitely — the 🔊 tap (and
                    // any tap on the stage) is that gesture, and once play()
                    // resolves we flip to the rtc path on the next tick.
                    ticksWithoutDecode++;
                    if (ticksWithoutDecode === 10) {
                        console.warn("webrtc: video paused, waiting for a gesture to unlock play()", inbound);
                    }
                    return;
                }
                path = "rtc";
                if (canvas) canvas.style.display = "none";
                wsAudioEnabled = false; // audio now flows via the RTP track
                videoEl.play?.().catch(() => {});
                sendWs({ t: "video-path", mode: "rtc" });
            } else {
                ticksWithoutDecode++;
                if (ticksWithoutDecode === 10) {
                    console.warn("webrtc: no decoded frames after 5s", inbound);
                    console.warn(`p2p stalled: pkts=${packetsReceived} recv=${framesReceived} dec=${framesDecoded} pli=${pliCount}`);
                }
                if (ticksWithoutDecode >= 20) {
                    console.warn("webrtc: giving up, staying on WebSocket path");
                    teardownRtc();
                    // no WS video exists on the signaling path — say why
                    // the screen is black instead of silently showing it
                    if (SIGNAL) setBadge(t.p2pFailed, "error");
                }
            }
            return;
        }
        const now = performance.now();
        const fps = Math.round(((framesDecoded - lastFrames) * 1000) / (now - lastTime));
        lastFrames = framesDecoded;
        lastTime = now;
        const size = videoEl?.videoWidth ? `${videoEl.videoWidth}×${videoEl.videoHeight}` : lastSize;
        setBadge(`${size} · P2P ${fps}fps`, "p2p");
    }, 500);
}

// normalized [0,1] coordinates; accounts for letterboxing in <video>.
// `rect` is optional — attachInput caches one per gesture and passes it in
// so a fast drag doesn't re-measure layout 100× a second.
function norm(el, e, rect) {
    rect ??= el.getBoundingClientRect();
    if (viewRotation) {
        // inside the rotator the element fills its box exactly (no
        // letterbox) — but the box is rotated, so un-rotate the point
        const u = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const v = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
        // rotate(90) cw: video x = visual y, video y = 1 - visual x
        if (viewRotation === 90) return { x: v, y: 1 - u };
        if (viewRotation === 180) return { x: 1 - u, y: 1 - v };
        return { x: 1 - v, y: u }; // 270
    }
    let { width, height } = rect;
    let ox = 0;
    let oy = 0;
    // <video> exposes the stream size via videoWidth; the decode canvas
    // carries it in width/height. Both can be letterboxed inside their
    // element box (.screen uses height:100% + object-fit:contain), and the
    // tap point must be mapped onto the *content* rect, not the element rect.
    const iw = el.videoWidth || el.width;
    const ih = el.videoHeight || el.height;
    if (iw && ih && !(iw === 300 && ih === 150)) { // ignore the default canvas size
        const scale = Math.min(rect.width / iw, rect.height / ih);
        width = iw * scale;
        height = ih * scale;
        ox = (rect.width - width) / 2;
        oy = (rect.height - height) / 2;
    }
    return {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left - ox) / width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top - oy) / height)),
    };
}

// ── pointer input ────────────────────────────────────────────────
// Goals:
//   1) One synchronous layout per gesture, not per event — mobile WebViews
//      sample pointermove at 60–120 Hz, and calling getBoundingClientRect
//      at that rate forces repeated reflows that make taps feel laggy.
//   2) Batch moves into one send per animation frame. iPhone 11 samples
//      touches at 120 Hz while the display runs at 60 Hz; a hard 16 ms
//      cutoff drops every other sample, whereas rAF picks exactly the last
//      position of each frame — the one that actually gets shown.
//   3) Track only the primary pointer, keyed by pointerId — a stray second
//      finger no longer flips the shared "down" flag and silently drops
//      the main drag.
//   4) Recover from iOS's habit of eating pointerup when a system gesture
//      (app switcher, notification pull-down, edge swipe) interrupts a
//      drag. Without an explicit release the device keeps the finger
//      pressed and the next tap looks like a bogus second pointer.
// module-scope hook set by attachInput; blur / visibilitychange invoke it
// to synthesize an "up" when the current gesture can no longer complete.
let releaseActiveTouch = null;
window.addEventListener("blur", () => releaseActiveTouch?.());
document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseActiveTouch?.();
});

function attachInput(el) {
    let activeId = null;
    let activeRect = null;
    let lastPos = null; // fallback coords for the synthesized "up"
    let pendingMove = null;
    let rafId = 0;

    const flushMove = () => {
        rafId = 0;
        if (!pendingMove) return;
        const p = pendingMove;
        pendingMove = null;
        lastPos = p;
        sendControl({ t: "touch", a: "move", x: p.x, y: p.y });
    };

    const finish = (p) => {
        if (activeId === null) return;
        const id = activeId;
        activeId = null;
        activeRect = null;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        pendingMove = null;
        try { el.releasePointerCapture(id); } catch {}
        const up = p || lastPos || { x: 0.5, y: 0.5 };
        sendControl({ t: "touch", a: "up", x: up.x, y: up.y });
        lastPos = null;
    };

    el.onpointerdown = (e) => {
        // Do NOT gate on e.isPrimary here. On iOS WebKit a fast second tap
        // fires its pointerdown *before* the first tap's pointerup arrives,
        // so WebKit reports the new pointer as isPrimary=false; the old
        // `if (!e.isPrimary) return;` silently dropped it, so the device got
        // an UP with no matching DOWN and every-other tap vanished (typing
        // 123456 registered 1,3,6). Desktop Chrome never hits this because a
        // mouse pointerup always precedes the next pointerdown. This surface
        // only ever models one finger (ScrcpyPointerId.Finger), so the newest
        // pointer always wins: finish any still-open gesture (which emits its
        // "up") then start the new one — DOWN→UP pairs stay intact no matter
        // how fast the taps come.
        if (activeId !== null) finish();
        activeId = e.pointerId;
        activeRect = el.getBoundingClientRect();
        try { el.setPointerCapture(e.pointerId); } catch {}
        if (el.tagName === "VIDEO") {
            // a tap is a user gesture — unlock a P2P <video> that mobile
            // WebViews paused despite autoplay (WeChat XWeb)
            el.play?.().catch(() => {});
        }
        const p = norm(el, e, activeRect);
        lastPos = p;
        sendControl({ t: "touch", a: "down", x: p.x, y: p.y });
        e.preventDefault();
    };

    el.onpointermove = (e) => {
        // track by pointerId only — isPrimary is unreliable on iOS (see above)
        if (activeId === null || e.pointerId !== activeId) return;
        // coalesce: WebKit fires pointermove faster than rAF on iOS
        // (120 Hz touch sampling vs 60 Hz display on iPhone 11), and the
        // last position in a frame is what matters — earlier positions in
        // the same frame are strictly superseded.
        pendingMove = norm(el, e, activeRect);
        if (!rafId) rafId = requestAnimationFrame(flushMove);
    };

    const end = (e) => {
        if (activeId === null || e.pointerId !== activeId) return;
        finish(norm(el, e, activeRect));
    };
    el.onpointerup = end;
    el.onpointercancel = end;

    // register a "release now" hook so a global blur / visibilitychange can
    // lift the finger when iOS kills the gesture mid-flight. Reassigned on
    // every attachInput (new canvas on reconnect) — the stale closure gets
    // GC'd with its canvas.
    releaseActiveTouch = () => { if (activeId !== null) finish(); };

    el.onwheel = (e) => {
        e.preventDefault();
        sendControl({ t: "scroll", ...norm(el, e), dx: -e.deltaX / 100, dy: -e.deltaY / 100 });
    };
    el.oncontextmenu = (e) => e.preventDefault();
}

// ── device shell ───────────────────────────────────────────────
let term = null;
let fitAddon = null;
let shellReady = false;

function sendShell(obj) {
    // mirrors sendControl: prefer the dedicated P2P channel
    if (shellDc?.readyState === "open") shellDc.send(JSON.stringify(obj));
    else sendWs(obj);
}

async function openShell() {
    if (!currentSerial) return;
    shellPanel.hidden = false;
    // shrink the layout instead of covering it, so the screen stays visible
    document.body.classList.add("with-shell");
    try {
        await loadXterm();
    } catch (e) {
        $("shell-title").textContent = `${t.shell}: ${e.message}`;
        return;
    }
    if (!term) {
        term = new Terminal({
            fontSize: 13,
            cursorBlink: true,
            theme: { background: "#0f1115", foreground: "#e6e8ec" },
        });
        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open($("terminal"));
        term.onData((d) => sendShell({ t: "shell-in", d }));
        term.onResize(({ rows, cols }) => sendShell({ t: "shell-resize", rows, cols }));
        // panel geometry changes on rotation / window resize
        new ResizeObserver(() => {
            if (!shellPanel.hidden) fitAddon?.fit();
        }).observe($("terminal"));
    }
    fitAddon.fit();
    term.focus();
    if (!shellReady) {
        sendShell({ t: "shell-start", rows: term.rows, cols: term.cols });
    }
}

function closeShell() {
    shellPanel.hidden = true;
    document.body.classList.remove("with-shell");
}

function handleShellMessage(msg) {
    if (msg.t === "shell-ready") {
        shellReady = true;
    } else if (msg.t === "shell-out") {
        const output = atob(msg.d || "");
        const bytes = new Uint8Array(output.length);
        for (let i = 0; i < output.length; i++) bytes[i] = output.charCodeAt(i);
        term?.write(bytes);
    } else if (msg.t === "shell-exit") {
        shellReady = false;
        term?.write(`\r\n\x1b[90m[${t.shellExited(msg.code)}]\x1b[0m\r\n`);
    } else if (msg.t === "shell-error") {
        shellReady = false;
        term?.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
    }
}

// physical keyboard passthrough (desktop); form fields keep their own keys
const isFormField = (t) => ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName);

// Chinese / Japanese / Korean IMEs do their magic via composition events:
// during composition Chrome/Edge fire keydown with `e.key === "Process"`
// (or `keyCode === 229` on Safari) and only expose the final string through
// `compositionend`. Without listening for it, non-ASCII typing was silently
// dropped here — the pinyin letters got filtered by `e.key.length === 1`,
// the composed Chinese never arrived.
window.addEventListener("compositionend", (e) => {
    if (isFormField(e.target) || !currentSerial) return;
    if (e.data) sendControl({ t: "text", text: e.data });
});

window.onkeydown = (e) => {
    if (isFormField(e.target) || !currentSerial) return;
    if (e.isComposing || e.keyCode === 229) return; // IME is mid-composition
    if (e.key === "Backspace") sendControl({ t: "key", code: 67, a: "down" });
    else if (e.key === "Enter") sendControl({ t: "key", code: 66, a: "down" });
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) sendControl({ t: "text", text: e.key });
};
window.onkeyup = (e) => {
    if (isFormField(e.target) || !currentSerial) return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Backspace") sendControl({ t: "key", code: 67, a: "up" });
    else if (e.key === "Enter") sendControl({ t: "key", code: 66, a: "up" });
};

// on-screen keyboard bar (mobile: summons the local IME, forwards to device)
// Composition state: while the user is picking a candidate, `.value` is
// empty and pressing Enter means "commit the candidate", not "send to
// device". We gate both the Enter handler and the send button so the
// composed text lands in `.value` before we ship it — that was the cause
// of the "字要一点点去点" report.
let kbdComposing = false;
let kbdPendingSend = false;

function flushKbdText() {
    const text = kbdInput.value;
    if (text) {
        sendControl({ t: "text", text });
        kbdInput.value = "";
    } else {
        // empty box + Enter = literal Enter on the device (matches the
        // previous behavior for password fields etc.)
        sendControl({ t: "key", code: 66, a: "down" });
        sendControl({ t: "key", code: 66, a: "up" });
    }
}
function sendKbdText() {
    if (kbdComposing) {
        // defer — compositionend will call us once the IME commits
        kbdPendingSend = true;
        return;
    }
    kbdPendingSend = false;
    flushKbdText();
}

kbdInput.addEventListener("compositionstart", () => { kbdComposing = true; });
kbdInput.addEventListener("compositionend", () => {
    kbdComposing = false;
    if (kbdPendingSend) {
        kbdPendingSend = false;
        // let the browser finish writing the committed text into `.value`
        // before we read it
        requestAnimationFrame(flushKbdText);
    }
});

$("btn-kbd").onclick = () => {
    setSettingsOpen(false); // the sheet would cover the bar it just opened
    kbdBar.hidden = !kbdBar.hidden;
    if (!kbdBar.hidden) kbdInput.focus();
};
// the send button must not steal focus (and thus commit the IME panel
// unexpectedly) on mobile; touchstart preventDefault keeps the input hot.
$("kbd-send").addEventListener("pointerdown", (e) => e.preventDefault());
$("kbd-send").onclick = sendKbdText;
kbdInput.onkeydown = (e) => {
    if (e.key === "Enter") {
        // candidate-commit Enter from a Chinese IME — pass through to the IME
        if (e.isComposing || e.keyCode === 229 || kbdComposing) return;
        e.preventDefault();
        sendKbdText();
    } else if (e.key === "Backspace" && !kbdInput.value
        && !e.isComposing && e.keyCode !== 229 && !kbdComposing) {
        sendControl({ t: "key", code: 67, a: "down" });
        sendControl({ t: "key", code: 67, a: "up" });
    }
};

for (const [id, code] of [["btn-back", 4], ["btn-home", 3], ["btn-recents", 187], ["btn-power", 26]]) {
    $(id).onclick = () => {
        sendControl({ t: "key", code, a: "down" });
        sendControl({ t: "key", code, a: "up" });
        setSettingsOpen(false); // get out of the way so the result is visible
    };
}

$("btn-fullscreen").onclick = () => {
    setSettingsOpen(false);
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
};

// ── view rotation: follow the device + manual correction ───────
// The stream adapts to device rotation on its own, but when the device goes
// landscape while the browser window is portrait, the content shrinks into a
// small bar. So rotation follows the *content*: when content and stage are
// "crossed", the view rotates by `bias` so the user can just turn their phone
// sideways (and once the browser window itself rotates, the view settles back
// to 0). The bias is remembered per content orientation: frame sizes can't
// tell 90° from 270° (reverse-landscape), so a wrong guess is corrected by
// tapping 🔄 once — and sticks for the next rotation.
let viewRotation = 0;
let rotationBias = { landscape: 90, portrait: 0, ...session.rotationBias };

// Authoritative stream size, as reported by the server (parsed out of the
// H.264/H.265 configuration). Element sizes are NOT trustworthy early on: a
// freshly created <canvas> is 300×150 by default, which reads as "landscape"
// and used to flip the view 90° depending on a timing race at page load.
let streamW = 0;
let streamH = 0;

// natural size of whatever is currently displayed
function contentSize() {
    if (streamW && streamH) return { W: streamW, H: streamH };
    if (path === "rtc" && videoEl?.videoWidth) {
        return { W: videoEl.videoWidth, H: videoEl.videoHeight };
    }
    // ignore a canvas that still carries the HTML default size / no size yet
    if (canvas?.width > 0 && canvas?.height > 0 &&
        !(canvas.width === 300 && canvas.height === 150)) {
        return { W: canvas.width, H: canvas.height };
    }
    return null;
}

function applyViewRotation() {
    document.getElementById("rotator")?.remove();
    const els = [canvas, videoEl].filter(Boolean);
    if (!viewRotation || !els.length) {
        // native layout: canvas in flow, <video> absolutely covering the stage
        for (const el of els) {
            el.style.cssText = "";
            if (el === canvas) {
                if (path === "rtc") el.style.display = "none";
            }
            stageEl.appendChild(el);
        }
        return;
    }
    const size = contentSize();
    if (!size) { viewRotation = 0; return; }
    const { W, H } = size;
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    // the rotator keeps the content's aspect ratio (no letterboxing inside),
    // and is scaled so that the *rotated* visual box fits the stage
    const k = viewRotation % 180 === 90
        ? Math.min(sw / H, sh / W)
        : Math.min(sw / W, sh / H);
    const rot = document.createElement("div");
    rot.id = "rotator";
    rot.style.cssText =
        `position:absolute;left:50%;top:50%;` +
        `width:${Math.round(W * k)}px;height:${Math.round(H * k)}px;` +
        `transform:translate(-50%,-50%) rotate(${viewRotation}deg);`;
    for (const el of els) {
        el.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;";
        if (el === canvas && path === "rtc") el.style.display = "none";
        rot.appendChild(el);
    }
    stageEl.appendChild(rot);
}

function paintRotateButton() {
    $("btn-rotate").textContent = viewRotation ? String(viewRotation) + "°" : "🔄";
}
// re-evaluate the follow rule; only acts when the answer actually changes
function autoRotate() {
    const size = contentSize();
    if (!size) return;
    const contentLandscape = size.W >= size.H;
    const stageLandscape = stageEl.clientWidth >= stageEl.clientHeight;
    const want = contentLandscape
        ? (stageLandscape ? 0 : rotationBias.landscape)
        : rotationBias.portrait;
    if (want !== viewRotation) {
        viewRotation = want;
        applyViewRotation();
        paintRotateButton();
    }
}

$("btn-rotate").onclick = () => {
    viewRotation = (viewRotation + 90) % 360;
    // remember the correction for this content orientation, so the next
    // device rotation auto-applies it (90 vs 270 can't be auto-detected)
    const size = contentSize();
    if (size) {
        rotationBias[size.W >= size.H ? "landscape" : "portrait"] = viewRotation;
        rememberSession({ rotationBias });
    }
    applyViewRotation();
    paintRotateButton();
};
window.addEventListener("resize", autoRotate);
document.addEventListener("fullscreenchange", autoRotate);
// the stage has no size until layout settles; re-evaluate whenever it changes
// (this also catches phone rotation, where `resize` can fire late)
if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => autoRotate()).observe(stageEl);
}

$("btn-shell").onclick = () => {
    setSettingsOpen(false);
    if (shellPanel.hidden) openShell().catch((e) => console.error("shell:", e));
    else closeShell();
};
$("shell-close").onclick = closeShell;

function setSettingsOpen(open) {
    settingsSheet.hidden = !open;
    settingsBackdrop.hidden = !open;
    // sheet + backdrop already cover the entire viewport; disabling pointer
    // events on the stage keeps any pointer that escapes the sheet (e.g. when
    // a finger slides out of a button across a select dropdown) from being
    // forwarded as a touch to the device
    stageEl.style.pointerEvents = open ? "none" : "";
    // iOS: freeze the page so opening the sheet (or focusing a field inside
    // it) can't scroll the body and make the fixed sheet "float".
    document.body.classList.toggle("sheet-open", open);
    if (open) {
        settingsSheet.scrollTop = 0;
        renderDeviceList(lastDevices); // always show live active/online state
    }
}

// the 断开 tile is only meaningful mid-session; dimming it when idle stops it
// looking broken before anything is connected.
function paintDisconnect() {
    const b = $("btn-disconnect");
    if (!b) return;
    b.classList.toggle("off", !currentSerial);
}

// no session yet → make the whole black stage tappable to open the device
// sheet, so the entry point isn't a tiny ⚙ the user has to hunt for.
stageEl.addEventListener("click", () => {
    if (!currentSerial && stageEl.childElementCount === 0) setSettingsOpen(true);
});
paintDisconnect();
$("settings-close").onclick = () => setSettingsOpen(false);
settingsBackdrop.onclick = () => setSettingsOpen(false);

// ── the settings button is also a drag handle ──
// a drag repositions it (and is remembered); a plain tap opens the sheet
const FAB_POS_KEY = "scrcpy-webrtc-fab-pos";
const fab = $("btn-settings");

function placeFab(x, y) {
    const w = fab.offsetWidth || 48;
    const h = fab.offsetHeight || 48;
    // never let it leave the viewport — a lost button would be unrecoverable
    const cx = Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4));
    const cy = Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4));
    fab.style.setProperty("--fab-x", `${cx}px`);
    fab.style.setProperty("--fab-y", `${cy}px`);
    fab.classList.add("placed");
    return [cx, cy];
}

try {
    const saved = JSON.parse(localStorage.getItem(FAB_POS_KEY) || "null");
    if (Array.isArray(saved)) placeFab(saved[0], saved[1]);
} catch {} // corrupt value — just fall back to the default corner

// rotation / window resize can push a saved position off screen
window.addEventListener("resize", () => {
    if (fab.classList.contains("placed")) placeFab(parseFloat(fab.style.getPropertyValue("--fab-x")), parseFloat(fab.style.getPropertyValue("--fab-y")));
});

// the move/up listeners sit on window: the pointer routinely leaves the 48px
// button, and we must keep following it until it is released
let fabDrag = null;
fab.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const r = fab.getBoundingClientRect();
    fabDrag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    fab.dataset.dragged = "0";
    fab.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
    if (fabDrag?.id !== e.pointerId) return;
    if (!fabDrag.moved) {
        // require a real drag, so a shaky tap still opens the sheet
        if (Math.hypot(e.clientX - fabDrag.sx, e.clientY - fabDrag.sy) < 6) return;
        fabDrag.moved = true;
        fab.classList.add("dragging");
    }
    [fabDrag.x, fabDrag.y] = placeFab(e.clientX - fabDrag.dx, e.clientY - fabDrag.dy);
});
const endFabDrag = (e) => {
    if (fabDrag?.id !== e.pointerId) return;
    const { moved, x, y } = fabDrag;
    fabDrag = null;
    fab.classList.remove("dragging");
    if (!moved) return;
    fab.dataset.dragged = "1"; // swallow the click that follows this gesture
    localStorage.setItem(FAB_POS_KEY, JSON.stringify([x, y]));
};
window.addEventListener("pointerup", endFabDrag);
window.addEventListener("pointercancel", endFabDrag);

fab.onclick = () => {
    if (fab.dataset.dragged === "1") {
        fab.dataset.dragged = "0";
        return;
    }
    setSettingsOpen(settingsSheet.hidden);
};

$("btn-disconnect").onclick = () => {
    disconnect();
    loadDevices();
    setSettingsOpen(true);
};

deviceSelect.onchange = () => {
    if (deviceSelect.value) {
        connect(deviceSelect.value);
        setSettingsOpen(false); // picking a device is the whole point of the sheet
    }
};
qualitySelect.onchange = () => {
    rememberSession({ quality: qualitySelect.value });
    sendWs({ t: "quality", preset: qualitySelect.value });
};
encoderSelect.onchange = () => {
    rememberEncoder(currentSerial, { video: encoderSelect.value });
    sendWs({ t: "encoder", name: encoderSelect.value });
};
audioEncoderSelect.onchange = () => {
    const codec = audioEncoderSelect.selectedOptions[0]?.dataset.codec ?? "";
    rememberEncoder(currentSerial, { audio: audioEncoderSelect.value, audioCodec: codec });
    sendWs({ t: "audio-encoder", name: audioEncoderSelect.value, codec });
};

// ── custom scrcpy options ────────────────────────────────
// hand-tuned overrides that beat both the quality preset and the dedicated
// encoder fields above; empty fields fall back to whatever the preset chose
const OPT_FIELDS = [
    { key: "maxSize", id: "opt-max-size", customId: "opt-max-size-custom", kind: "number" },
    // Mbps in the UI, bps on the wire — scrcpy-server's option is in bps and
    // users reason in Mbps, so convert at the boundary
    { key: "videoBitRate", id: "opt-video-bit-rate", customId: "opt-video-bit-rate-custom", kind: "mbps" },
    { key: "maxFps", id: "opt-max-fps", customId: "opt-max-fps-custom", kind: "number" },
    { key: "videoCodec", id: "opt-video-codec", kind: "select" },
    { key: "videoEncoder", id: "opt-video-encoder", customId: "opt-video-encoder-custom", kind: "string" },
    { key: "audioEncoder", id: "opt-audio-encoder", customId: "opt-audio-encoder-custom", kind: "string" },
    { key: "audioBitRate", id: "opt-audio-bit-rate", customId: "opt-audio-bit-rate-custom", kind: "number" },
    { key: "screenOffTimeout", id: "opt-screen-off-timeout", customId: "opt-screen-off-timeout-custom", kind: "number" },
];
const BUILTIN_KEYS = new Set(OPT_FIELDS.map((f) => f.key));
const CUSTOM_OPTION = "__custom__";

function syncCustomEncoderOptions(id, source) {
    const select = $(id);
    if (select?.tagName !== "SELECT") return;
    const options = selectOptions(select);
    if (options.length === 0) return;
    const custom = select.value === CUSTOM_OPTION;
    const customValue = $(`${id}-custom`)?.value ?? "";
    let selected = custom ? CUSTOM_OPTION : select.value;
    const first = options[0];
    select.replaceChildren(first);
    for (const option of selectOptions(source).slice(1)) {
        if (!option.value || option.value === CUSTOM_OPTION ||
            selectOptions(select).some((item) => item.value === option.value)) continue;
        select.add(new Option(option.textContent, option.value));
    }
    select.add(new Option("自定义…", CUSTOM_OPTION));
    if (selected === CUSTOM_OPTION && customValue) {
        const found = selectOptions(select).some((option) => option.value === customValue);
        if (found) {
            selected = customValue;
            $(`${id}-custom`).value = "";
        }
    }
    select.value = selected;
    $(`${id}-custom`).hidden = select.value !== CUSTOM_OPTION;
}

function customFieldValue(field) {
    const select = $(field.id);
    return select.value === CUSTOM_OPTION ? $(field.customId).value.trim() : select.value.trim();
}

function readCustomOptions() {
    const out = {};
    for (const f of OPT_FIELDS) {
        const el = $(f.id);
        if (!el) continue;
        const v = customFieldValue(f);
        if (!v) continue;
        if (f.kind === "number") {
            const n = Number(v);
            if (!Number.isFinite(n)) continue;
            out[f.key] = n;
        } else if (f.kind === "mbps") {
            const n = Number(v);
            if (!Number.isFinite(n) || n <= 0) continue;
            out[f.key] = Math.round(n * 1_000_000);
        } else {
            out[f.key] = v;
        }
    }
    for (const row of $("opt-extra-list").querySelectorAll(".opt-extra-row")) {
        const k = row.querySelector(".opt-k").value.trim();
        const v = row.querySelector(".opt-v").value.trim();
        if (!k) continue;
        const n = Number(v);
        if (v !== "" && Number.isFinite(n) && String(n) === v) out[k] = n;
        else out[k] = v;
    }
    return out;
}

function writeCustomOptions(obj) {
    obj = obj || {};
    for (const f of OPT_FIELDS) {
        const el = $(f.id);
        if (!el) continue;
        const custom = f.customId ? $(f.customId) : null;
        if (f.key in obj) {
            const v = obj[f.key];
            const value = f.kind === "mbps" && typeof v === "number"
                ? String(Math.round((v / 1_000_000) * 10) / 10)
                : String(v);
            if (selectOptions(el).some((option) => option.value === value)) {
                el.value = value;
                if (custom) custom.value = "";
            } else if (custom) {
                el.value = CUSTOM_OPTION;
                custom.value = value;
            } else {
                el.value = value;
            }
        } else {
            el.value = "";
            if (custom) custom.value = "";
        }
        if (custom) custom.hidden = el.value !== CUSTOM_OPTION;
    }
    const list = $("opt-extra-list");
    list.innerHTML = "";
    for (const [k, v] of Object.entries(obj)) {
        if (BUILTIN_KEYS.has(k)) continue;
        addExtraRow(k, v);
    }
    updateCustomOptionsCount();
}

function addExtraRow(k = "", v = "") {
    const list = $("opt-extra-list");
    const row = document.createElement("div");
    row.className = "opt-extra-row";
    const ki = document.createElement("input");
    ki.className = "opt-k";
    ki.placeholder = "key";
    ki.value = k;
    const vi = document.createElement("input");
    vi.className = "opt-v";
    vi.placeholder = "value";
    vi.value = String(v);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "mini";
    rm.textContent = "✕";
    rm.onclick = () => { row.remove(); updateCustomOptionsCount(); };
    row.append(ki, vi, rm);
    list.appendChild(row);
}

function updateCustomOptionsCount() {
    const n = Object.keys(readCustomOptions()).length;
    const tag = $("custom-options-count");
    if (!tag) return;
    tag.hidden = n === 0;
    tag.textContent = n === 1 ? "(1 项)" : `(${n} 项)`;
}

function sendCustomOptions() {
    const opts = readCustomOptions();
    // the audio toggle owns the `audio` field — make sure extra-row edits
    // can't shadow it
    if (!audioEnabled) opts.audio = false;
    else delete opts.audio;
    rememberSession({ customOptions: opts, audioEnabled });
    sendWs({ t: "options", options: opts });
    updateCustomOptionsCount();
}

writeCustomOptions(session.customOptions);
$("opt-apply").onclick = sendCustomOptions;
$("opt-reset").onclick = () => { writeCustomOptions(null); sendCustomOptions(); };
$("opt-extra-add").onclick = () => addExtraRow();
for (const f of OPT_FIELDS) {
    const el = $(f.id);
    if (el) el.addEventListener("change", () => {
        if (f.customId) $(f.customId).hidden = el.value !== CUSTOM_OPTION;
        updateCustomOptionsCount();
    });
    const custom = f.customId ? $(f.customId) : null;
    if (custom) custom.addEventListener("input", updateCustomOptionsCount);
}
syncCustomEncoderOptions("opt-video-encoder", encoderSelect);
syncCustomEncoderOptions("opt-audio-encoder", audioEncoderSelect);

// shows the remembered state before the first click
$("btn-mute").textContent = muted ? "🔇" : "🔊";
function paintSoundButton() {
    const b = $("btn-mute");
    // device audio off takes precedence in the icon — that's the unusual state
    if (!audioEnabled) {
        b.textContent = "🚫";
        b.classList.add("off");
        b.title = "设备音频已关闭（长按恢复）";
    } else {
        b.textContent = muted ? "🔇" : "🔊";
        b.classList.remove("off");
        b.title = muted ? "已静音（单击发声，长按关闭设备音频）"
                        : "有声（单击静音，长按关闭设备音频）";
    }
}
paintSoundButton();

// one button, two gestures:
//   tap     → toggle browser-side muted (videoEl.muted)
//   long-press (≥600ms) → toggle device-side audio (server restart)
let soundPressTimer = null;
function cancelSoundPress() {
    if (soundPressTimer) {
        clearTimeout(soundPressTimer);
        soundPressTimer = null;
    }
}
$("btn-mute").addEventListener("pointerdown", () => {
    cancelSoundPress();
    soundPressTimer = setTimeout(() => {
        soundPressTimer = null;
        audioEnabled = !audioEnabled;
        rememberSession({ audioEnabled });
        paintSoundButton();
        const opts = readCustomOptions();
        if (!audioEnabled) opts.audio = false;
        else delete opts.audio;
        writeCustomOptions(opts);
        sendCustomOptions();
    }, 600);
});
$("btn-mute").addEventListener("pointerup", () => {
    if (!soundPressTimer) return; // long-press already fired
    cancelSoundPress();
    muted = !muted;
    // not persisted: every new tab/session begins silent so the browser's
    // autoplay policy is satisfied without a NotAllowedError on first play
    paintSoundButton();
    // iOS plays the remote track through a hidden <audio>: this tap is the
    // gesture that lets it un-mute and start emitting sound.
    if (rtcAudioEl) {
        rtcAudioEl.muted = muted;
        rtcAudioEl.play?.().catch(() => {});
    }
    // both audio paths (WS decode + RTP track) flow through audioGain, so
    // toggling its gain mutes/unmutes either one. videoEl itself must stay
    // muted — an unmuted <video> makes iOS pop up its native player.
    if (videoEl) {
        videoEl.muted = true;
        videoEl.play?.().catch(() => {});
    }
    // this tap is the user gesture that lets the WS audio pipeline start too.
    // create the AudioContext here (within the gesture) if the very first
    // audio packet hasn't arrived yet — otherwise resume() on a still-null
    // ctx is a no-op and the stream stays silent until the user taps again
    try { ensureAudioGraph(); } catch {}
    audioCtx.resume().catch(() => {});
});
$("btn-mute").addEventListener("pointerleave", cancelSoundPress);
$("btn-mute").addEventListener("pointercancel", cancelSoundPress);

async function adbConnect() {
    const ip = adbHostInput.value.trim();
    const port = Number(adbPortInput.value);
    if (!ip || !Number.isFinite(port) || port < 1 || port > 65535) {
        setBadge(t.adbConnectFailed("invalid ip or port"), "error");
        return;
    }
    try {
        const res = await fetch(`${HTTP_BASE}/api/adb-connect?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, {
            headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
        });
        if (res.status === 401) {
            setBadge(t.unauthorizedHint, "error");
            return;
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        rememberSession({ adbHost: ip, adbPort: port });
        setBadge(t.adbConnected, "p2p");
        await loadDevices();
    } catch (e) {
        setBadge(t.adbConnectFailed(e.message), "error");
    }
}
adbConnectBtn.onclick = adbConnect;
adbHostInput.onkeydown = (e) => { if (e.key === "Enter") adbConnect(); };
adbPortInput.onkeydown = (e) => { if (e.key === "Enter") adbConnect(); };

// ── “外部浏览器”入口（飞牛移动 App 内嵌 WKWebView 吞快速连点，见
// docs/ios-app-wkwebview-touch-issue.md）──
// 一个按钮同时做两件事：① 复制地址（万一没跳成可手粘）② 调 openURL 唤起
// 系统浏览器。地址用 location.origin + 网关前缀重建。
// token 按部署环境分两种处理：
//   • /app/<name> 前缀一定是 fnOS 统一网关（native fpk 与 docker fpk 都是），它
//     往内嵌页 URL 里注入的是 fnOS 自己的会话 token。本应用服务端从未配 --token
//     （VIEW_NEEDS_TOKEN=false）不需要它；而把它拼到别的域名（自建 DDNS）会被
//     fnOS 网关拒为 invalid token（0.1.35 实测），所以这里必须剔掉。
//   • 其他前缀是普通 Docker/VPS 部署，用户经常用 --token 保护页面，而 Safari 是
//     独立上下文读不到 localStorage，地址不带 token 就会直接 401，所以要带上。
const FN_APP = /fnOS|fnClient|feiniu|fnnas/i.test(navigator.userAgent || "");
const openBrowserRow = $("row-open-browser");
const openBrowserBtn = $("btn-open-browser");
if (openBrowserBtn) {
    openBrowserBtn.textContent = t.openInBrowserBtn;
    openBrowserBtn.title = t.openInBrowserHint;
}
if (FN_APP && openBrowserRow) openBrowserRow.hidden = false;
// openURL 到底有没有把浏览器带到前台，SDK 自己不证明：移动端分支走
// callAppMethod("openSystemBrowser", url)，而它对“handler 没注册”也是静默 resolve
// （dist 源码里 callAppMethod 开头 return null，d.ts 返回类型就是 Promise<unknown>）。
// 0.1.37 实测“提示已请求打开但 Safari 没跳”就是这种。故用页面可见性收尾：系统
// 浏览器接管后本页一定会转 hidden（比 blur 可靠，弹层/键盘也会 blur）。
function waitHidden(ms) {
    if (document.visibilityState === "hidden") return Promise.resolve(true);
    return new Promise((resolve) => {
        const done = (v) => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVis);
            resolve(v);
        };
        const onVis = () => { if (document.visibilityState === "hidden") done(true); };
        const timer = setTimeout(() => done(false), ms);
        document.addEventListener("visibilitychange", onVis);
    });
}
openBrowserBtn?.addEventListener("click", async () => {
    const externalUrl =
        location.origin + PREFIX +
        (!PREFIX.startsWith("/app/") && TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "");
    let copied = false;
    try {
        await navigator.clipboard.writeText(externalUrl);
        copied = true;
    } catch {
        const ta = document.createElement("textarea");
        ta.value = externalUrl;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        try { copied = document.execCommand("copy"); } catch {}
        ta.remove();
    }
    let sdk = null;
    let bridgeFailed = false;
    try {
        const { TrimApp } = await import("@trimjs/web-app");
        sdk = new TrimApp();
    } catch {
        bridgeFailed = true;
    }
    // isWeb / isStandaloneWeb 是在 init 的 Promise 执行器里同步赋值的，构完就能读；
    // UA 里的 FNAppVer/x.y.z 决定 isWeb=false，跟页面是不是真在微应用宿主里无关。
    const diag = sdk ? `isWeb=${sdk.isWeb}${sdk.isStandaloneWeb ? ",standalone" : ""}` : "sdk=none";
    if (sdk) {
        // 手机（isWeb=false）走原生 openSystemBrowser，必须给完整绝对 URL；
        // PC（isWeb=true）走 window.open。这里传的已经是绝对地址。
        const call = sdk.openURL(externalUrl, "_blank");
        call.catch(() => {}); // 超时后迟到的 reject 不能变成未处理异常
        try {
            // 桥不存在时 init 永不 resolve（Docker 版 type=url 直连容器端口、
            // manifest 又没声明 micro_app 就是这个情况），openURL 首行 yield
            // initPromise 会跟着永久挂死，故加 5 秒超时让失败可见。
            await Promise.race([
                call,
                new Promise((_, reject) => setTimeout(() => reject(new Error("host bridge timeout")), 5000)),
            ]);
        } catch {
            bridgeFailed = true;
        }
        if (!bridgeFailed && (await waitHidden(1500))) {
            setBadge(t.openInBrowserOpened(externalUrl), "p2p");
            return;
        }
    }
    // 兜底再试一次自己开新窗口：普通浏览器弹被拦截时 window.open 返回 null（可判定），
    // App 内则多半被 InAppWebView 的 createWindow 吃掉，试一次不亏。
    try { window.open(externalUrl, "_blank"); } catch {}
    if (await waitHidden(1200)) {
        setBadge(t.openInBrowserOpened(externalUrl), "p2p");
        return;
    }
    setBadge(
        !copied
            ? t.openInBrowserCopyFailed(externalUrl)
            : bridgeFailed
                ? t.openInBrowserCopied(externalUrl)
                : t.openInBrowserIgnored(externalUrl, diag),
        "warn",
    );
});

// clipboard sync: browser -> device on tab focus (permission permitting)
window.addEventListener("focus", async () => {
    if (!currentSerial || !navigator.clipboard?.readText) return;
    try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipFromDevice && text !== lastClipToDevice) {
            lastClipToDevice = text;
            sendControl({ t: "clipboard", text });
        }
    } catch {} // permission denied — ignore silently
});

$("refresh").onclick = loadDevices;
window.addEventListener("convert-phone:connect", (event) => {
    const serial = event.detail?.serial;
    if (serial) {
        muted = false;
        connect(serial);
        // The card click is the browser gesture that unlocks playback. Create
        // and resume the graph here rather than requiring the old settings
        // sheet's sound button.
        try { ensureAudioGraph(); } catch {}
        audioCtx?.resume?.().catch(() => {});
        window.dispatchEvent(new CustomEvent("convert-phone:audio", { detail: { enabled: true } }));
    }
});
window.addEventListener("convert-phone:toggle-audio", () => {
    const button = $("btn-mute");
    if (!button) return;
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
});
window.addEventListener("convert-phone:disconnect", () => disconnect());
mountProductShell();
loadDevices();
