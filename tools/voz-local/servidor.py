"""
Servidor local de voz clonada do E-Nova (Chatterbox Multilingual, Resemble AI, licença MIT).

Só escuta em 127.0.0.1. O E-Nova sobe este processo quando precisa e conversa por HTTP:
  GET  /saude              -> {"ok": true, "dispositivo": "cuda"|"cpu", "carregado": bool}
  POST /falar  (JSON)      -> áudio WAV
       {"texto": "...", "referencia": "C:/.../voz.wav", "idioma": "pt", "expressividade": 0.5}

A referência é o áudio da pessoa (10 s a 60 s). Nada sai do computador.
"""
import io
import json
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORTA = int(os.environ.get("VOZ_LOCAL_PORTA", "7861"))
_modelo = None
_trava = threading.Lock()
_dispositivo = None


def dispositivo():
    global _dispositivo
    if _dispositivo:
        return _dispositivo
    import torch
    _dispositivo = "cpu"
    forcar = os.environ.get("VOZ_LOCAL_DISPOSITIVO")
    if forcar in ("cpu", "cuda"):
        _dispositivo = forcar
    elif torch.cuda.is_available():
        livre, _ = torch.cuda.mem_get_info()
        # em meia precisão (16 bits) o modelo usa ~2,3 GB; com menos livre, a CPU é mais segura
        _dispositivo = "cuda" if livre >= 2.5 * 1024**3 else "cpu"
    return _dispositivo


def modelo():
    global _modelo
    if _modelo is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _modelo = ChatterboxMultilingualTTS.from_pretrained(device=dispositivo())
        if dispositivo() == "cuda":
            # 16 bits na placa: ~8x mais rápido numa placa de 4 GB (em 32 bits ela transborda para a memória comum)
            import torch
            _modelo.t3 = _modelo.t3.to(dtype=torch.float16)
    return _modelo


def partes(texto: str, maximo: int = 260):
    """Frases curtas: o modelo fica mais estável e não corta o fim."""
    frases = re.split(r"(?<=[.!?…])\s+", texto.strip())
    out, atual = [], ""
    for f in frases:
        if len(atual) + len(f) + 1 > maximo and atual:
            out.append(atual)
            atual = f
        else:
            atual = f"{atual} {f}".strip()
    if atual:
        out.append(atual)
    return [p for p in out if p]


def falar(texto: str, referencia: str, idioma: str, expressividade: float) -> bytes:
    import torch
    import torchaudio
    m = modelo()
    pedacos = []
    silencio = torch.zeros(1, int(m.sr * 0.18))
    for p in partes(texto):
        if dispositivo() == "cuda":
            with torch.autocast("cuda", dtype=torch.float16):
                wav = m.generate(p, language_id=idioma, audio_prompt_path=referencia, exaggeration=expressividade, cfg_weight=0.5)
        else:
            wav = m.generate(p, language_id=idioma, audio_prompt_path=referencia, exaggeration=expressividade, cfg_weight=0.5)
        pedacos += [wav.float().cpu(), silencio]
    tudo = torch.cat(pedacos[:-1] if pedacos else [silencio], dim=1)
    buf = io.BytesIO()
    torchaudio.save(buf, tudo, m.sr, format="wav")
    return buf.getvalue()


class Pedido(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silencioso
        pass

    def _json(self, codigo, dados):
        corpo = json.dumps(dados).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if self.path == "/saude":
            return self._json(200, {"ok": True, "dispositivo": dispositivo(), "carregado": _modelo is not None})
        self._json(404, {"erro": "não existe"})

    def do_POST(self):
        if self.path != "/falar":
            return self._json(404, {"erro": "não existe"})
        try:
            tam = int(self.headers.get("Content-Length", "0"))
            d = json.loads(self.rfile.read(min(tam, 200_000)))
            texto = str(d.get("texto", ""))[:6000]
            ref = str(d.get("referencia", ""))
            if not texto.strip() or not os.path.isfile(ref):
                return self._json(400, {"erro": "faltou texto ou áudio de referência"})
            with _trava:  # um de cada vez: a placa de vídeo não aguenta dois
                wav = falar(texto, ref, str(d.get("idioma", "pt"))[:5], float(d.get("expressividade", 0.5)))
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.end_headers()
            self.wfile.write(wav)
        except Exception as e:  # noqa: BLE001
            self._json(500, {"erro": str(e)[:500]})


if __name__ == "__main__":
    if "--aquecer" in sys.argv:
        modelo()  # baixa e carrega o modelo uma vez
        print("modelo pronto em", dispositivo(), flush=True)
        sys.exit(0)
    print(f"voz-local ouvindo em 127.0.0.1:{PORTA} ({dispositivo()})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORTA), Pedido).serve_forever()
