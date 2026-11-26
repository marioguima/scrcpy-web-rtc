# Áudio Redroid no Convert Phone

## Estado

O Redroid Android 11 usado no teste não possui encoder Opus. Ele expõe AAC e
FLAC. O `scrcpy-server` consegue capturar AAC, mas o transporte WebRTC atual do
fork anuncia uma trilha `audio/opus` e o cliente web decodifica Opus.

Consequentemente, apenas trocar `audio-codec` para AAC não resolve o áudio no
navegador. A captura passa a existir, mas não é reproduzível pela trilha atual.

## Próxima implementação

O agente deverá capturar PCM ou AAC e converter para Opus no gateway próximo ao
Redroid. Negociar AAC ponta a ponta exigiria alterar SDP, packetização RTP e
compatibilidade do navegador.

## Diagnóstico controlado

O servidor agora aceita `AUDIO_CODEC`/`--audio-codec` para testar a captura
disponível no dispositivo. Isso não declara suporte AAC no navegador; o log
deve indicar explicitamente quando a trilha capturada não é compatível com
WebRTC Opus.
