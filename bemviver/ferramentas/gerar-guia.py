# Gera as trilhas do suspiro fisiológico guiado do app: cada fase tem o SEU som, como a
# taça fazia, mas liso e macio (sem metal), com passarinhos baixinho ao longe e o tempo
# final de observação. Substitui a taça tibetana (24/11/2026).
#
#   1ª inspiração (3,5 s): som 1, médio (Sol4 + Ré5). Começa nítido e cresce até o fim.
#   2ª inspiração (1,5 s): som 2, mais agudo (Ré5 + Sol5). O som 1 para e o 2 começa
#                   nítido e cresce: dá para contar "um, dois".
#   expiração (6 s): som 3, mais quente (Ré4 + Sol4 + Si4). Começa nítido e vai se
#                   apagando devagar, liso, até o fim do ar.
#
# Um som só por fase: sem degraus dentro da fase (deixavam a respiração "picotada"),
# sem nota que desliza (soava como "sirene") e sem grave contínuo ("filme de terror").
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
FASES = [("inspira", 3.5), ("inspira2", 1.5), ("solta", 6.0)]  # 11 s por ciclo
CICLO = sum(d for _, d in FASES)
OBSERVAR = 30.0          # depois do último ciclo: observar-se e reconhecer a mudança

D4, G4, B4, D5, G5 = 293.66, 392.0, 493.88, 587.33, 783.99


def filtro(x, tipo, f):
    return sosfilt(butter(2, f, btype=tipo, fs=SR, output='sos'), x)


def eco(x, rng, seg=2.0, mistura=0.3):
    k = np.arange(int(SR * seg)) / SR
    ir = filtro(rng.standard_normal(len(k)) * np.exp(-k / (seg / 6.9)), 'lowpass', 4000)
    ir /= np.sqrt(np.sum(ir ** 2))
    return (1 - mistura) * x + mistura * fftconvolve(x, ir)[:len(x)]


SONS = {
    "inspira":  [(G4, 1.0), (D5, 0.55)],
    "inspira2": [(D5, 0.9), (G5, 0.8)],
    "solta":    [(D4, 0.7), (G4, 1.0), (B4, 0.55)],
}


def som_fase(nome, d):
    """Um som por fase: ataque nítido mas macio (80 ms), depois liso até o fim da fase."""
    fim_som = d - 0.12 if nome != "solta" else d          # respiro curto antes do próximo som
    tt = np.arange(int(SR * (d + 0.6))) / SR
    s = np.zeros(len(tt))
    for f, a in SONS[nome]:
        for h, ah in ((1, 1.0), (2, 0.22), (3, 0.07)):
            s += a * ah * np.sin(2 * np.pi * f * h * tt + h)
    ataque = np.sin(np.pi / 2 * np.minimum(tt / 0.08, 1))
    if nome == "solta":
        u = np.clip(tt / fim_som, 0, 1)
        corpo = 1 - (0.5 - 0.5 * np.cos(np.pi * u ** 0.85))   # se apaga até o fim do ar
    else:
        u = np.clip(tt / fim_som, 0, 1)
        corpo = 0.6 + 0.4 * np.sin(np.pi / 2 * u)               # cresce: o ar entrando
        corpo *= np.clip((fim_som - tt) / 0.10, 0, 1)           # fecha suave antes do próximo
    return s * ataque * corpo / sum(a for _, a in SONS[nome])


# ---------- Passarinhos ao longe (mesma síntese da caminhada) ----------
def nota(f0, f1, dur, rng, vibr=0.0):
    tt = np.arange(int(SR * dur)) / SR
    curva = f0 + (f1 - f0) * (0.5 - 0.5 * np.cos(np.pi * tt / dur))
    curva *= 1 + vibr * np.sin(2 * np.pi * rng.uniform(22, 34) * tt)
    fase = 2 * np.pi * np.cumsum(curva) / SR
    return (np.sin(fase) + 0.12 * np.sin(2 * fase)) * np.sin(np.pi * tt / dur) ** 1.6


def canto_assobio(rng):
    base = rng.uniform(2100, 2900); partes = []
    for _ in range(rng.integers(3, 6)):
        f0 = base * rng.choice([1.0, 1.12, 1.26, 0.89, 1.19])
        partes.append(nota(f0, f0 * rng.uniform(0.9, 1.15), rng.uniform(0.12, 0.32), rng, rng.uniform(0, 0.012)))
        partes.append(np.zeros(int(SR * rng.uniform(0.05, 0.14))))
    return np.concatenate(partes)


def canto_piado(rng):
    partes = []
    for _ in range(rng.integers(2, 5)):
        f0 = rng.uniform(4200, 5200)
        partes.append(nota(f0, f0 * rng.uniform(0.62, 0.75), rng.uniform(0.05, 0.08), rng))
        partes.append(np.zeros(int(SR * rng.uniform(0.08, 0.16))))
    return np.concatenate(partes) * 0.5


def passaros(n, rng):
    out = np.zeros((2, n))
    tipos = [canto_assobio, canto_assobio, canto_assobio, canto_piado]
    t0 = rng.uniform(1.0, 2.5)
    while t0 < n / SR - 2:
        canto = tipos[rng.integers(len(tipos))](rng)
        distancia = rng.uniform(0.75, 1.0)                   # sempre longe
        canto = filtro(canto, 'lowpass', 6000 - 3000 * distancia) * (0.9 - 0.55 * distancia)
        pan = rng.uniform(0.15, 0.85)
        i = int(t0 * SR); b = min(i + len(canto), n)
        out[0, i:b] += canto[:b - i] * np.sqrt(1 - pan)
        out[1, i:b] += canto[:b - i] * np.sqrt(pan)
        t0 += rng.uniform(3.0, 7.0)
    return np.stack([eco(c, rng, 3.0, 0.6) for c in out])


def trilha(ciclos):
    total = ENTRADA + ciclos * CICLO + OBSERVAR
    n = int(SR * (total + 1))
    rng = np.random.default_rng(21)
    guia = np.zeros(n)

    def soma(sig, quando, ganho=1.0):
        i = int(quando * SR); j = min(n, i + len(sig)); guia[i:j] += sig[:j - i] * ganho

    ganho = {"inspira": 0.8, "inspira2": 0.9, "solta": 1.0}
    t = ENTRADA
    for _ in range(ciclos):
        for nome, d in FASES:
            soma(som_fase(nome, d), t, ganho[nome]); t += d
    # depois do último ciclo, o som da expiração volta uma vez, longo, e abre a observação
    soma(som_fase("solta", 9.0) * 0.7, t + 0.4)
    guia = eco(filtro(guia, 'lowpass', 3000), rng, 1.8, 0.25)
    aves = passaros(n, rng)
    tt = np.arange(n) / SR
    fade = np.clip(tt / 2.0, 0, 1) * np.clip((total + 1 - tt) / 8, 0, 1)
    mix = np.stack([guia, guia]) / np.max(np.abs(guia)) + aves / np.max(np.abs(aves)) * 0.08
    mix *= fade
    return mix / np.max(np.abs(mix)) * 0.8, total


aqui = os.path.dirname(os.path.abspath(__file__))
destino = os.path.join(aqui, '..', 'public', 'bemviver', 'audio')
for nome, ciclos in (("guia-1-minuto", 6), ("guia-5-minutos", 27)):
    sinal, total = trilha(ciclos)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        w = wave.open(tmp.name, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sinal.T * 32767).astype('<i2').tobytes()); w.close()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-b:a', '96k',
                        os.path.join(destino, nome + '.mp3')], check=True)
        os.unlink(tmp.name)
    print(nome, f'{ciclos} ciclos, {total:.1f} s')
