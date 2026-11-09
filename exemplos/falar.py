"""Texto → MP3 na voz Artur, sem passar da cota grátis do Google (só biblioteca padrão).

Uso:
  export GOOGLE_TTS_API_KEY=...          # ou no .env da raiz
  python3 exemplos/falar.py "Texto a falar" [saida.mp3]

Custo zero: antes de cada chamada, um contador local (.uso/AAAA-MM.json) confere
se o texto cabe em 95% da cota grátis do mês. Se a voz principal não couber,
usa a reserva (WaveNet); se nenhuma couber, recusa e não chama o Google.
Num sistema com vários servidores, troque este contador por um banco
(contador/voz_uso.sql).
"""
import base64
import datetime
import json
import os
import pathlib
import sys
import urllib.request
import zoneinfo

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CFG = json.loads((RAIZ / "voz.json").read_text(encoding="utf-8"))
SERVICO = CFG["servico"]
COTA = CFG["cota_gratis_mensal"]


def env(nome: str, padrao: str | None = None) -> str | None:
    if os.environ.get(nome):
        return os.environ[nome]
    arq = RAIZ / ".env"
    if arq.exists():
        for linha in arq.read_text(encoding="utf-8").splitlines():
            if linha.startswith(f"{nome}="):
                return linha.split("=", 1)[1].strip() or padrao
    return padrao


def mes_do_google() -> str:
    """A fatura do Google fecha no horário do Pacífico."""
    return datetime.datetime.now(zoneinfo.ZoneInfo("America/Los_Angeles")).strftime("%Y-%m")


def reservar(voz: str, caracteres: int) -> bool:
    """Soma os caracteres no contador do mês se couberem no limite seguro."""
    pasta = RAIZ / ".uso"
    pasta.mkdir(exist_ok=True)
    arq = pasta / f"{mes_do_google()}.json"
    uso = json.loads(arq.read_text()) if arq.exists() else {}
    # limite próprio deste sistema quando a cota é dividida com outro (ex.: dois sistemas usando a mesma chave)
    proprio = env("ARTUR_LIMITE_PRINCIPAL") if voz == SERVICO["voz"] else env("ARTUR_LIMITE_RESERVA")
    limite = int(proprio) if proprio else int(COTA[voz] * COTA["limite_seguro"])
    if uso.get(voz, 0) + caracteres > limite:
        return False
    uso[voz] = uso.get(voz, 0) + caracteres
    arq.write_text(json.dumps(uso, indent=2))
    return True


def sintetizar(texto: str, voz: str, velocidade: float) -> bytes:
    corpo = {
        "input": {"text": texto},
        "voice": {"languageCode": SERVICO["idioma"], "name": voz},
        "audioConfig": {"audioEncoding": SERVICO["formato"], "speakingRate": velocidade},
    }
    chave = env("GOOGLE_TTS_API_KEY") or sys.exit("Defina GOOGLE_TTS_API_KEY (variável de ambiente ou .env).")
    req = urllib.request.Request(
        env("GOOGLE_TTS_ENDPOINT", SERVICO["endpoint"]),
        data=json.dumps(corpo).encode(),
        # chave no cabeçalho, nunca na URL
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": chave},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return base64.b64decode(json.load(r)["audioContent"])


def falar(texto: str, velocidade: float | None = None) -> tuple[bytes, str]:
    vel = velocidade or SERVICO["velocidade"]
    for voz in (SERVICO["voz"], CFG["reserva"]["voz"]):
        if reservar(voz, len(texto)):
            return sintetizar(texto, voz, vel), voz
    raise RuntimeError("Cota grátis do mês esgotada nas duas vozes; nada foi enviado ao Google.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    audio, voz = falar(sys.argv[1])
    destino = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "artur.mp3")
    destino.write_bytes(audio)
    print(f"{destino} ({voz})")
