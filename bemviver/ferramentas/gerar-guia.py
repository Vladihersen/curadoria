# Gera as trilhas do suspiro fisiológico guiado do app: toques suaves de kalimba no
# ritmo de cada fase, sobre um acorde de Sol maior bem baixinho, ao longe, mais
# o tempo final de observação. Substitui a taça tibetana (24/11/2026).
#
#   1ª inspiração : um toque só, longo e calmo (Sol4), enquanto o fundo cresce
#   2ª inspiração : um "tim-tim" rápido e mais brilhante (Ré5 e Sol5 colados), o
#                   "mais um pouquinho, por cima": o ritmo diferente separa as duas
#   expiração     : quatro toques descendo devagar (Ré5, Si4, Lá4, Sol4), cada vez mais
#                   suaves, terminando sempre na nota de repouso
# Nada de grave contínuo, de notas desafinadas entre si ou de tom que desliza de altura
# (soavam como "filme de terror" ou "sirene" nos testes).
#
#   python3 gerar-guia.py   -> public/bemviver/audio/guia-1-minuto.mp3 e guia-5-minutos.mp3
#   (precisa de numpy, scipy e ffmpeg)
#
# A tela do app lê o mesmo roteiro (CONDUCAO em app.js): se mudar um tempo aqui,
# mude lá também.
import numpy as np, subprocess, tempfile, os, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
ENTRADA = 4.0            # sente-se, deixe o corpo pesar
FASES = [("inspira", 2.4, 0.72), ("inspira2", 1.5, 1.0), ("solta", 5.5, 0.0)]  # 9,4 s por ciclo
CICLO = sum(d for _, d, _ in FASES)
OBSERVAR = 30.0          # depois do último ciclo: observar-se e reconhecer a mudança

G3, A3, B3, D4, G4, A4, B4, D5, G5 = 196.0, 220.0, 246.94, 293.66, 392.0, 440.0, 493.88, 587.33, 783.99
# (momento dentro da fase, em fração da fase, nota)
MELODIA = {
    "inspira":  [(0.0, G4)],
    "inspira2": [(0.0, D5), (0.12, G5)],
    "solta":    [(0.0, D5), (0.22, B4), (0.44, A4), (0.66, G4)],
}


def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)


def toque(f, dur, a=1.0):
    """Kalimba macia: ataque arredondado, decaimento natural, sem metal."""
    tt = np.arange(int(dur * SR)) / SR
    s = (np.exp(-tt / (dur * 0.35)) * np.sin(2 * np.pi * f * tt)
         + 0.20 * np.exp(-tt / (dur * 0.15)) * np.sin(2 * np.pi * 2 * f * tt)
         + 0.05 * np.exp(-tt / 0.15) * np.sin(2 * np.pi * 4 * f * tt))
    s *= (1 - np.exp(-tt / 0.008)) * np.clip((dur - tt) / 0.3, 0, 1)
    return lp(s, 5000) * a


def fundo_claro(b):
    """Fundo ao longe: acorde de Sol maior (Ré4, Sol4, Si4) sem grave, abafado e espalhado
    por um eco suave, como se viesse de outra sala. Varia pouco com o ar, para não pulsar."""
    n = len(b); t = np.arange(n) / SR
    s = np.zeros(n)
    for f, a in ((D4, 0.6), (G4, 0.8), (B4, 0.5)):
        s += a * np.sin(2 * np.pi * f * t)
    s = lp(s * (0.8 + 0.2 * b), 900)
    # eco: resposta de sala de 3 s, ruído que se apaga devagar
    k = np.arange(int(3.0 * SR)) / SR
    ir = np.random.default_rng(2).standard_normal(len(k)) * np.exp(-k / 0.7)
    ir = lp(ir, 1500)
    s = 0.25 * s + fftconvolve(s, ir)[:n] / np.sqrt(np.sum(ir ** 2)) * 0.9
    ar = hp(lp(np.random.default_rng(5).standard_normal(n), 2500), 600)
    return s / np.max(np.abs(s)) + ar / np.std(ar) * 0.012


def trilha(ciclos):
    total = ENTRADA + ciclos * CICLO + OBSERVAR
    n = int(SR * (total + 1))
    out = np.zeros(n); b = np.zeros(n)

    def soma(sig, quando):
        i = int(quando * SR); j = min(n, i + len(sig)); out[i:j] += sig[:j - i]

    t, nivel = ENTRADA, 0.0
    for _ in range(ciclos):
        for nome, d, alvo in FASES:
            i, j = int(t * SR), int((t + d) * SR); u = np.arange(j - i) / (j - i)
            e = 1 - (1 - u) ** 2.2 if nome == "solta" else u
            b[i:j] = nivel + (alvo - nivel) * (0.5 - 0.5 * np.cos(np.pi * e)); nivel = alvo
            notas = MELODIA[nome]
            for k, (frac, f) in enumerate(notas):
                if nome == "solta":
                    a = 0.9 - 0.45 * k / (len(notas) - 1); dur = 2.4 if k < len(notas) - 1 else 3.5
                elif nome == "inspira2":
                    a, dur = (0.8, 1.2) if k == 0 else (1.0, 1.8)
                else:
                    a, dur = 0.7, 2.8
                soma(toque(f, dur, a), t + frac * d)
            t += d
    # Fim da respiração: um acorde longo e macio abre o tempo de observação.
    for f, a in ((G3, 0.5), (D4, 0.45), (G4, 0.5), (B4, 0.3)):
        soma(toque(f, 9.0, a), t + 0.4)
    toques = out / np.max(np.abs(out))
    tt = np.arange(n) / SR
    fade = np.clip(tt / 2.0, 0, 1) * np.clip((total + 1 - tt) / 8, 0, 1)
    mix = (toques + fundo_claro(b) * 0.07) * fade
    return mix / np.max(np.abs(mix)) * 0.8, total


aqui = os.path.dirname(os.path.abspath(__file__))
destino = os.path.join(aqui, '..', 'public', 'bemviver', 'audio')
for nome, ciclos in (("guia-1-minuto", 6), ("guia-5-minutos", 32)):
    sinal, total = trilha(ciclos)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        w = wave.open(tmp.name, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sinal * 32767).astype('<i2').tobytes()); w.close()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-ac', '1', '-b:a', '64k',
                        os.path.join(destino, nome + '.mp3')], check=True)
        os.unlink(tmp.name)
    print(nome, f'{ciclos} ciclos, {total:.1f} s')
