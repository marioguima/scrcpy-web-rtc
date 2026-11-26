# Instruções do fork scrcpy-web-rtc

Este fork é a implementação de transporte usada pelo Convert Phone.

## Branches e sincronização

- Todo código novo ou correção deve ser desenvolvido e testado em `develop`.
- `develop` é a fonte de trabalho do fork `marioguima/scrcpy-web-rtc`.
- Depois da validação local, fazer commit e push em `develop`.
- Após a aprovação, fazer merge de `develop` em `main`; nunca corrigir
  diretamente `main`.
- O repositório `upstream` é `chenshaogui/scrcpy-web-rtc` e deve ser
  consultado para sincronizações e correções relevantes.
- O Convert Phone deve consumir uma revisão explícita deste fork, nunca o
  upstream diretamente.

## Compatibilidade com o Convert Phone

Alterações de áudio, controle, sessão ou protocolo devem ser testadas no
Convert Phone antes do merge em `main`. Não remover o fallback WebSocket nem
alterar o pipeline AAC → Opus sem repetir o teste funcional de áudio no
navegador.

Não usar GitHub Actions. Segredos, sessões Android e dados de dispositivos não
entram no Git.
