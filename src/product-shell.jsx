import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { CslStandaloneProvider } from "@csl/ui/theme/standalone";
import { CslStandaloneAppShell } from "@csl/ui/layouts/standalone";
import { CslStandaloneSidebar, CslStandaloneTopbar } from "@csl/ui/navigation/standalone";
import cslStyles from "@csl/ui/styles.css";

const rootId = "convert-product-root";

function ConvertPhoneShell() {
    useEffect(() => {
        const host = document.getElementById("convert-stage-mount");
        const stage = document.getElementById("stage-wrap");
        if (host && stage) host.appendChild(stage);
    }, []);

    return React.createElement(
        CslStandaloneProvider,
        { mode: "light", primaryColor: "#7367f0" },
        React.createElement(CslStandaloneAppShell, {
            sidebarWidth: 240,
            sidebar: React.createElement(CslStandaloneSidebar, {
                brandName: "Convert Phone",
                activeId: "phones",
                items: [
                    { id: "phones", label: "Telefones", icon: React.createElement("span", null, "▣") },
                    { id: "files", label: "Arquivos", icon: React.createElement("span", null, "▤") },
                    { id: "settings", label: "Configurações", icon: React.createElement("span", null, "⚙") },
                ],
            }),
            topbar: React.createElement(CslStandaloneTopbar, {
                title: "Convert Phone",
                actions: React.createElement("span", { id: "convert-topbar-status" }, "Aguardando dispositivo"),
            }),
            children: React.createElement("div", { id: "convert-stage-mount" }),
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
