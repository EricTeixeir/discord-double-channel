#Requires AutoHotkey v2.0
; ============================================================
; Trash Talk Relay — hotkey global
; F8 liga/desliga o relay (funciona com o CS em tela cheia).
; Para trocar a tecla, mude o "F8::" abaixo (ex.: "F9::", "^!t::" = Ctrl+Alt+T).
;
; NO PC ONDE O BOT RODA: deixe baseUrl como está (127.0.0.1).
; EM OUTRO PC: troque baseUrl pela URL do túnel (docker compose logs tunnel),
;              ex.: baseUrl := "https://alguma-coisa.trycloudflare.com"
; O token abaixo é a senha do controle — tem que ser igual ao CONTROL_TOKEN
; do .env. Não compartilhe fora do grupo.
; ============================================================

baseUrl := "http://IP_OU_DOMINIO:3123"
token   := "COLOQUE_O_CONTROL_TOKEN_AQUI"

F8:: {
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("POST", baseUrl "/toggle", false)
        req.SetRequestHeader("Authorization", "Bearer " token)
        req.SetTimeouts(3000, 3000, 3000, 3000)
        req.Send()
        if (req.Status = 401) {
            SoundBeep(200, 400)
            TrayTip("Trash Talk", "Token errado — confira o CONTROL_TOKEN do .env", "Icon!")
            return
        }
        ativo := InStr(req.ResponseText, "true") > 0
        if (ativo) {
            SoundBeep(880, 120)   ; beep agudo = LIGOU
            TrayTip("Trash Talk", "Relay ATIVO — os times estão se ouvindo", "Iconi")
        } else {
            SoundBeep(440, 120)   ; beep grave = desligou
            TrayTip("Trash Talk", "Relay desligado", "Iconi")
        }
    } catch {
        SoundBeep(200, 400)       ; beep bem grave = erro
        TrayTip("Trash Talk", "Não consegui falar com o bot. Ele está rodando? (docker compose up -d)", "Icon!")
    }
}
