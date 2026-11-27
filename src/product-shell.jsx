import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CslStandaloneProvider } from "@csl/ui/theme/standalone";
import { CslStandaloneAppShell } from "@csl/ui/layouts/standalone";
import { CslStandaloneSidebar, CslStandaloneTopbar } from "@csl/ui/navigation/standalone";
import cslStyles from "@csl/ui/styles.css";
import { Avatar, Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@csl/ui/components";

const rootId = "convert-product-root";

function ConvertPhoneShell() {
    const [devices, setDevices] = useState([]);
    const [activeSerial, setActiveSerial] = useState("");
    const [status, setStatus] = useState("Aguardando dispositivo");

    useEffect(() => {
        const host = document.getElementById("convert-stage-mount");
        const stage = document.getElementById("stage-wrap");
        if (host && stage) host.appendChild(stage);
        const onDevices = (event) => setDevices(event.detail?.devices ?? []);
        const onSession = (event) => {
            setActiveSerial(event.detail?.serial ?? "");
            setStatus(event.detail?.status ?? "Aguardando dispositivo");
        };
        window.addEventListener("convert-phone:devices", onDevices);
        window.addEventListener("convert-phone:session", onSession);
        if (window.__convertPhoneDevices) setDevices(window.__convertPhoneDevices);
        return () => {
            window.removeEventListener("convert-phone:devices", onDevices);
            window.removeEventListener("convert-phone:session", onSession);
        };
    }, []);

    const models = [
        { id: "android11", title: "Android 11", subtitle: "Redroid · modelo de teste", serialHint: "redroid-video-test11", tone: "success" },
        { id: "android13", title: "Android 13", subtitle: "Redroid · WhatsApp disponível", serialHint: "android01", tone: "warning" },
    ];
    const findDevice = (model) => devices.find((device) => {
        const identity = `${device.serial} ${device.model ?? ""} ${device.product ?? ""}`.toLowerCase();
        const hints = model.id === "android11"
            ? ["redroid-video-test11", "redroid11", ":15572"]
            : ["android01", "redroid13", ":15555"];
        return hints.some((hint) => identity.includes(hint));
    });
    const openDevice = (model) => {
        const device = findDevice(model);
        if (device) window.dispatchEvent(new CustomEvent("convert-phone:connect", { detail: { serial: device.serial } }));
    };

    return React.createElement(
        CslStandaloneProvider,
        { mode: "light", primaryColor: "#7367f0" },
        React.createElement(Box, { sx: { width: "100vw", minHeight: "100vh" } },
        React.createElement(CslStandaloneAppShell, {
            sidebarWidth: 240,
            sidebar: React.createElement(CslStandaloneSidebar, {
                brandName: "Convert Phone",
                activeId: "phones",
                items: [
                    { id: "phones", label: "Telefones", icon: React.createElement("i", { className: "ri-smartphone-line" }) },
                    { id: "files", label: "Arquivos", icon: React.createElement("i", { className: "ri-folder-line" }) },
                    { id: "settings", label: "Configurações", icon: React.createElement("i", { className: "ri-settings-3-line" }) },
                ],
            }),
            topbar: React.createElement(CslStandaloneTopbar, {
                title: "Convert Phone",
                actions: React.createElement("span", { id: "convert-topbar-status" }, "Aguardando dispositivo"),
            }),
            children: React.createElement(Stack, { spacing: 4 },
                    React.createElement(Stack, { spacing: 0.5 },
                        React.createElement(Stack, { direction: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 },
                            React.createElement(Typography, { variant: "h4" }, "Telefones"),
                            React.createElement(Chip, { label: status, color: activeSerial ? "success" : "default", variant: activeSerial ? "filled" : "outlined" }),
                        ),
                        React.createElement(Typography, { color: "text.secondary" }, "Gerencie e acesse os aparelhos do seu workspace."),
                    ),
                    React.createElement(Grid, { container: true, spacing: 2 }, models.map((model) => {
                        const device = findDevice(model);
                        const active = device?.serial === activeSerial;
                        return React.createElement(Grid, { item: true, xs: 12, sm: 6, lg: 4, key: model.id },
                            React.createElement(Card, { variant: "outlined", sx: { height: "100%", cursor: device ? "pointer" : "default", borderColor: active ? "primary.main" : undefined }, onClick: () => openDevice(model) },
                                React.createElement(CardContent, null,
                                    React.createElement(Stack, { spacing: 2 },
                                        React.createElement(Stack, { direction: "row", spacing: 2, alignItems: "center" },
                                            React.createElement(Avatar, { variant: "rounded" }, "A"),
                                            React.createElement(Box, { sx: { minWidth: 0, flex: 1 } },
                                                React.createElement(Typography, { variant: "h6" }, model.title),
                                                React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, model.subtitle),
                                            ),
                                            React.createElement(Chip, { size: "small", label: device ? "Disponível" : "Não conectado", color: device ? model.tone : "default" }),
                                        ),
                                        React.createElement(Typography, { variant: "body2", color: "text.secondary" }, device ? `${device.model ?? device.product ?? "Android"} · ${device.serial}` : "O ambiente ainda não está conectado ao backend local."),
                                        React.createElement(Button, { variant: device ? "contained" : "outlined", disabled: !device, onClick: (event) => { event.stopPropagation(); openDevice(model); } }, active ? "Em uso" : device ? "Abrir telefone" : "Aguardando conexão"),
                                    ),
                                ),
                            ),
                        );
                    })),
                    React.createElement(Box, { id: "convert-stage-mount", hidden: !activeSerial, sx: { display: activeSerial ? "flex" : "none", minHeight: activeSerial ? 560 : 0, height: activeSerial ? "min(72dvh, 800px)" : 0, overflow: "hidden", borderRadius: 1 } }),
                ),
        })),
    );
}

export function mountProductShell() {
    if (!document.getElementById(rootId)) return;
    if (!document.head.querySelector("style[data-csl-ui]") && typeof cslStyles === "string") {
        const style = document.createElement("style");
        style.dataset.cslUi = "true";
        style.textContent = cslStyles;
        document.head.appendChild(style);
    }
    createRoot(document.getElementById(rootId)).render(React.createElement(ConvertPhoneShell));
}
