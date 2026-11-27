import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CslStandaloneProvider } from "@csl/ui/theme/standalone";
import { CslStandaloneAppShell } from "@csl/ui/layouts/standalone";
import { CslStandaloneSidebar, CslStandaloneTopbar } from "@csl/ui/navigation/standalone";
import cslStyles from "@csl/ui/styles.css";
import { Alert, Avatar, Box, Button, Card, CardContent, CardHeader, Chip, Divider, Grid, IconButton, Stack, Tooltip, Typography } from "@csl/ui/components";

const rootId = "convert-product-root";

function MetricCard({ icon, color, value, label, trend, hint }) {
    return React.createElement(Card, { sx: { height: "100%" } }, React.createElement(CardContent, null,
        React.createElement(Stack, { spacing: 1.25 },
            React.createElement(Stack, { direction: "row", justifyContent: "space-between", alignItems: "flex-start" },
                React.createElement(Avatar, { variant: "rounded", sx: { bgcolor: `${color}.light`, color: `${color}.main` } }, React.createElement("i", { className: icon })),
                React.createElement(Typography, { variant: "body2", color: trend?.startsWith("-") ? "error.main" : "success.main", fontWeight: 600 }, trend),
            ),
            React.createElement(Typography, { variant: "h5", fontWeight: 600 }, value),
            React.createElement(Typography, { variant: "body2", color: "text.secondary" }, label),
            hint ? React.createElement(Chip, { label: hint, size: "small", sx: { alignSelf: "flex-start" } }) : null,
        ),
    ));
}

function PhoneCard({ model, device, active, onOpen }) {
    const available = Boolean(device);
    return React.createElement(Card, { sx: { height: "100%", border: active ? 2 : 1, borderColor: active ? "primary.main" : "divider", transition: "box-shadow 160ms ease, transform 160ms ease", "&:hover": available ? { boxShadow: 6, transform: "translateY(-2px)" } : undefined } }, React.createElement(CardContent, null,
        React.createElement(Stack, { spacing: 2 },
            React.createElement(Stack, { direction: "row", spacing: 1.5, alignItems: "center" },
                React.createElement(Avatar, { variant: "rounded", sx: { bgcolor: "action.hover", color: "text.primary" } }, "A"),
                React.createElement(Box, { sx: { minWidth: 0, flex: 1 } },
                    React.createElement(Typography, { variant: "h6", noWrap: true }, model.title),
                    React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, model.subtitle),
                ),
                React.createElement(Chip, { size: "small", label: active ? "Em uso" : available ? "Disponível" : "Não conectado", color: active || available ? "success" : "default" }),
            ),
            React.createElement(Typography, { variant: "body2", color: "text.secondary", sx: { minHeight: 40 } }, available ? `${device.model ?? device.product ?? "Android"} · ${device.serial}` : "O ambiente ainda não está conectado ao backend local."),
            React.createElement(Button, { fullWidth: true, variant: available ? "contained" : "outlined", disabled: !available, onClick: () => onOpen(model) }, active ? "Telefone em uso" : available ? "Abrir telefone" : "Aguardando conexão"),
        ),
    ));
}

function DashboardSummary({ devices, activeSerial, onOpen }) {
    const models = [
        { id: "android11", title: "Android 11", subtitle: "Redroid · modelo de teste", hints: ["redroid-video-test11", "redroid11", ":15572"] },
        { id: "android13", title: "Android 13", subtitle: "Redroid · WhatsApp disponível", hints: ["android01", "redroid13", ":15555"] },
    ];
    const findDevice = (model) => devices.find((device) => {
        const identity = `${device.serial ?? ""} ${device.model ?? ""} ${device.product ?? ""}`.toLowerCase();
        return model.hints.some((hint) => identity.includes(hint));
    });
    return React.createElement(Stack, { spacing: 3 },
        React.createElement(Stack, { direction: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 },
            React.createElement(Box, null, React.createElement(Typography, { variant: "h4", fontWeight: 600 }, "Telefones"), React.createElement(Typography, { color: "text.secondary" }, "Gerencie e acesse os aparelhos do seu workspace.")),
            React.createElement(Chip, { label: activeSerial ? "Dispositivo conectado" : "Aguardando dispositivo", variant: activeSerial ? "filled" : "outlined", color: activeSerial ? "success" : "default" }),
        ),
        React.createElement(Alert, { severity: "info", icon: React.createElement("i", { className: "ri-information-line" }) }, "Os modelos abaixo representam os ambientes Redroid disponíveis para esta instalação."),
        React.createElement(Grid, { container: true, spacing: 3 },
            React.createElement(Grid, { size: { xs: 12, sm: 6, md: 3 } }, React.createElement(MetricCard, { icon: "ri-smartphone-line", color: "primary", value: String(devices.length || 0), label: "Dispositivos conectados", trend: devices.length ? "+1 ativo" : "0 ativos", hint: "Estado atual" })),
            React.createElement(Grid, { size: { xs: 12, sm: 6, md: 3 } }, React.createElement(MetricCard, { icon: "ri-play-circle-line", color: "success", value: activeSerial ? "1" : "0", label: "Sessões em uso", trend: activeSerial ? "+100%" : "0%", hint: "Ao vivo" })),
            React.createElement(Grid, { size: { xs: 12, sm: 6, md: 3 } }, React.createElement(MetricCard, { icon: "ri-android-line", color: "warning", value: "2", label: "Modelos disponíveis", trend: "+2", hint: "Android 11 · 13" })),
            React.createElement(Grid, { size: { xs: 12, sm: 6, md: 3 } }, React.createElement(MetricCard, { icon: "ri-volume-up-line", color: "info", value: "AAC", label: "Áudio remoto", trend: "Ativo", hint: "WebRTC / Opus" })),
        ),
        React.createElement(Card, null, React.createElement(CardHeader, { title: "Meus telefones", subheader: "Selecione um aparelho para abrir a sessão remota." }), React.createElement(CardContent, null,
            React.createElement(Grid, { container: true, spacing: 2 }, models.map((model) => React.createElement(Grid, { size: { xs: 12, md: 6 }, key: model.id }, React.createElement(PhoneCard, { model, device: findDevice(model), active: findDevice(model)?.serial === activeSerial, onOpen })))),
        )),
    );
}

function ConvertPhoneShell() {
    const [devices, setDevices] = useState([]);
    const [activeSerial, setActiveSerial] = useState("");
    const [status, setStatus] = useState("Aguardando dispositivo");
    const [audioOn, setAudioOn] = useState(true);
    useEffect(() => {
        const host = document.getElementById("convert-stage-mount");
        const stage = document.getElementById("stage-wrap");
        if (host && stage) host.appendChild(stage);
        const onDevices = (event) => setDevices(event.detail?.devices ?? []);
        const onSession = (event) => { setActiveSerial(event.detail?.serial ?? ""); setStatus(event.detail?.status ?? "Aguardando dispositivo"); };
        const onAudio = (event) => setAudioOn(event.detail?.enabled !== false);
        window.addEventListener("convert-phone:devices", onDevices);
        window.addEventListener("convert-phone:session", onSession);
        window.addEventListener("convert-phone:audio", onAudio);
        if (window.__convertPhoneDevices) setDevices(window.__convertPhoneDevices);
        return () => { window.removeEventListener("convert-phone:devices", onDevices); window.removeEventListener("convert-phone:session", onSession); window.removeEventListener("convert-phone:audio", onAudio); };
    }, []);
    const openDevice = (model) => {
        const hints = model.id === "android11" ? ["redroid-video-test11", "redroid11", ":15572"] : ["android01", "redroid13", ":15555"];
        const device = devices.find((item) => hints.some((hint) => `${item.serial ?? ""} ${item.model ?? ""} ${item.product ?? ""}`.toLowerCase().includes(hint)));
        if (device) window.dispatchEvent(new CustomEvent("convert-phone:connect", { detail: { serial: device.serial } }));
    };
    const toggleAudio = () => { window.dispatchEvent(new CustomEvent("convert-phone:toggle-audio")); setAudioOn((value) => !value); };
    const disconnect = () => window.dispatchEvent(new CustomEvent("convert-phone:disconnect"));
    return React.createElement(CslStandaloneProvider, { mode: "light", primaryColor: "#7367f0" }, React.createElement(CslStandaloneAppShell, {
        sidebarWidth: 240,
        sidebar: React.createElement(CslStandaloneSidebar, { brandName: "Convert Phone", activeId: "phones", items: [
            { id: "phones", label: "Telefones", icon: React.createElement("i", { className: "ri-smartphone-line" }) },
            { id: "files", label: "Arquivos", icon: React.createElement("i", { className: "ri-folder-line" }) },
            { id: "settings", label: "Configurações", icon: React.createElement("i", { className: "ri-settings-3-line" }) },
        ] }),
        topbar: React.createElement(CslStandaloneTopbar, { title: "Convert Phone", actions: React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center" },
            React.createElement(Chip, { label: status, size: "small", color: activeSerial ? "success" : "default", variant: activeSerial ? "filled" : "outlined" }),
            activeSerial ? React.createElement(Tooltip, { title: audioOn ? "Desativar áudio" : "Ativar áudio" }, React.createElement(IconButton, { onClick: toggleAudio, color: audioOn ? "primary" : "default", "aria-label": "Áudio" }, React.createElement("i", { className: audioOn ? "ri-volume-up-line" : "ri-volume-mute-line" }))) : null,
            activeSerial ? React.createElement(Tooltip, { title: "Desconectar" }, React.createElement(IconButton, { onClick: disconnect, color: "error", "aria-label": "Desconectar" }, React.createElement("i", { className: "ri-close-circle-line" }))) : null,
        ) }),
        children: React.createElement(Stack, { spacing: 3 }, React.createElement(DashboardSummary, { devices, activeSerial, onOpen: openDevice }), React.createElement(Card, { id: "convert-stage-card", sx: { display: activeSerial ? "block" : "none", overflow: "hidden" } }, React.createElement(CardHeader, { title: "Tela do telefone", subheader: "Interaja com o aparelho remotamente." }), React.createElement(Divider, null), React.createElement(Box, { id: "convert-stage-mount", sx: { minHeight: 560, height: "min(72dvh, 800px)", overflow: "auto", bgcolor: "#050505", display: "flex", justifyContent: "center" } }))),
    }));
}

export function mountProductShell() {
    if (!document.getElementById(rootId)) return;
    if (!document.head.querySelector("style[data-csl-ui]") && typeof cslStyles === "string") { const style = document.createElement("style"); style.dataset.cslUi = "true"; style.textContent = cslStyles; document.head.appendChild(style); }
    createRoot(document.getElementById(rootId)).render(React.createElement(ConvertPhoneShell));
}
