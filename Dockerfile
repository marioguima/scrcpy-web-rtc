# Base image. Default is Docker Hub (guaranteed multi-arch manifest).
# Override via `--build-arg NODE_IMAGE=<your-mirror>/node:22.23.2-slim` if your
# local mirror doesn't carry a multi-arch manifest for arm64 / amd64.
ARG NODE_IMAGE=docker.io/node:22.23.2-slim
FROM --platform=$TARGETPLATFORM ${NODE_IMAGE}

LABEL maintainer="sgchen <1451023420@qq.com>"
LABEL description="scrcpy - Web-based scrcpy client"
LABEL version="1.0"

ENV LANG=C.UTF-8
ENV HOST=0.0.0.0
ENV PORT=8010
ENV NODE_ENV=production
ENV ADB_HOST=127.0.0.1
ENV ADB_PORT=5037
# China-friendly mirrors so the build doesn't hang on npmjs.org / GitHub
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
# esbuild >= 0.16 ignores .npmrc; this env var is what install.js actually reads
ENV ESBUILD_BINARY_MIRROR=https://registry.npmmirror.com/-/binary/esbuild


COPY . /app
WORKDIR /app

# 更换为清华镜像源
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list


RUN apt-get update && \
    apt-get install -y --no-install-recommends android-tools-adb ffmpeg curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    # NODE_ENV=production above makes npm skip devDeps; force-install them for esbuild
    npm ci --include=dev && \
    npm run build && \
    # Pull scrcpy-server jar straight from the Genymobile release with curl (much
    # more forgiving retries than got/gh-release-fetch, which dies on a single
    # TLS reset during Docker's network setup). 30 retries * 5 s covers the
    # usual GitHub-CDN hiccups. Then we re-create the package's index.js /
    # version.js so server.mjs can still `import { BIN } from '@yume-chan/fetch-scrcpy-server'`.
    curl -fSL --retry 30 --retry-delay 5 --retry-all-errors \
        --connect-timeout 15 --max-time 600 \
        -o node_modules/@yume-chan/fetch-scrcpy-server/server.bin \
        https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-server-v3.1 && \
    printf "export const VERSION = '3.1';\nexport const BIN = /* #__PURE__ */ new URL('./server.bin', import.meta.url);\n" \
        > node_modules/@yume-chan/fetch-scrcpy-server/index.js && \
    printf "export const VERSION = '3.1';\n" \
        > node_modules/@yume-chan/fetch-scrcpy-server/version.js


COPY scrcpy-webrtc-entrypoint.sh /usr/local/bin/
# Strip Windows CRLF line endings (left by COPYing from a Windows host); the
# trailing \r turns the shebang into '#!/usr/bin/env bash\r', which the Linux
# kernel can't exec — it reports 'exec format error' on the script path.
RUN chmod +x /usr/local/bin/scrcpy-webrtc-entrypoint.sh \
    && sed -i 's/\r$//' /usr/local/bin/scrcpy-webrtc-entrypoint.sh

EXPOSE 8010
ENTRYPOINT ["scrcpy-webrtc-entrypoint.sh"]
CMD ["node", "server.mjs", "--no-page", "--no-signal"]
