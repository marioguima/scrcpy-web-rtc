import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CslProvider } from "@csl/ui/theme";
import { CslAppShell } from "@csl/ui/layouts";
import { CslSidebar, CslTopbar } from "@csl/ui/navigation";
import cslStyles from "@csl/ui/styles.css";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@csl/ui/components";

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
        CslProvider,
        { mode: "light", primaryColor: "#7367f0" },
        React.createElement(CslAppShell, {
            mode: "light",
            systemMode: "light",
            settingsCookie: { skin: "default", layout: "vertical", contentWidth: "wide", navbarContentWidth: "wide" },
            sidebar: React.createElement(CslSidebar, {
                brandName: "Convert Phone",
                sections: [{ items: [
                    { label: "Telefones", href: "/", icon: "ri-smartphone-line" },
                    { label: "Arquivos", href: "/arquivos", icon: "ri-folder-line" },
                    { label: "Configurações", href: "/configuracoes", icon: "ri-settings-3-line" },
                ] }],
            }),
            topbar: React.createElement(CslTopbar, {
                searchPlaceholder: "Buscar",
                actions: React.createElement("span", { id: "convert-topbar-status" }, "Aguardando dispositivo"),
            }),
            children: React.createElement(Box, { sx: { height: "100%", minHeight: 0, overflow: "auto", p: { xs: 2, md: 4 } } },
                React.createElement(Stack, { spacing: 3, sx: { maxWidth: 1280, mx: "auto" } },
                    React.createElement(Stack, { direction: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 },
                        React.createElement(Box, null,
                            React.createElement(Typography, { variant: "h4", sx: { fontWeight: 700 } }, "Telefones"),
                            React.createElement(Typography, { color: "text.secondary" }, "Gerencie e acesse os aparelhos do seu workspace."),
                        ),
                        React.createElement(Chip, { label: status, color: activeSerial ? "success" : "default", variant: activeSerial ? "filled" : "outlined" }),
                    ),
                    React.createElement(Alert, { severity: "info" }, "Os modelos abaixo representam os ambientes Redroid disponíveis para esta instalação."),
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
                    React.createElement(Box, { id: "convert-stage-mount", sx: { display: activeSerial ? "flex" : "none", minHeight: activeSerial ? 560 : 0, height: activeSerial ? "min(72dvh, 800px)" : 0, overflow: "hidden", borderRadius: 1 } }),
                ),
            ),
        }),
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
    if (!document.head.querySelector("style[data-convert-phone-transport]")) {
        const style = document.createElement("style");
        style.dataset.convertPhoneTransport = "true";
        style.textContent = `
            #convert-product-root { height: 100dvh; min-height: 0; }
            #convert-stage-mount { height: 100%; min-height: 0; display: flex; overflow: hidden; padding: 0; }
            #convert-stage-mount > #stage-wrap { width: 100%; height: 100%; min-height: 0; }
        `;
        document.head.appendChild(style);
    }
    createRoot(document.getElementById(rootId)).render(React.createElement(ConvertPhoneShell));
}
