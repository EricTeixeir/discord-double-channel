#Requires AutoHotkey v2.0
; ============================================================
; Trash Talk Relay — hotkey global
; F8 liga/desliga o relay (funciona com o CS em tela cheia).
; Para trocar a tecla, mude o "F8::" abaixo (ex.: "F9::", "^!t::" = Ctrl+Alt+T).
;
; Feedback é só sonoro (o aviso "de verdade" toca dentro do canal de voz):
;   beep agudo = ligou | beep grave = desligou | beep longo baixo = erro
;
; NO PC ONDE O BOT RODA: deixe baseUrl como está (127.0.0.1).
; EM OUTRO PC: troque baseUrl pela URL/IP do servidor do bot.
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
        if (req.Status != 200) {
            SoundBeep(200, 400)   ; erro (token errado ou resposta inesperada)
            return
        }
        if (InStr(req.ResponseText, "true") > 0)
            SoundBeep(880, 120)   ; ligou
        else
            SoundBeep(440, 120)   ; desligou
    } catch {
        SoundBeep(200, 400)       ; erro (bot fora do ar / sem rede)
    }
}
