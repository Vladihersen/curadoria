# Gera as versões do "minuto de caminhada": uma taça marca o começo, um minuto de
# paisagem sonora (maré, brisa e/ou pássaros) e duas taças marcam o fim.
#
#   python3 gerar-caminhada.py PASTA_DE_SAIDA
#
# Tudo é sintetizado aqui (sem gravações de terceiros), em estéreo.
import numpy as np, subprocess, sys, os, tempfile, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
ANTES = 3.0      # silêncio suave antes da taça de início
MINUTO = 60.0
DEPOIS = 9.0     # taça final soando até apagar
TOTAL = ANTES + MINUTO + DEPOIS
N = int(SR * TOTAL)
T = np.arange(N) / SR


def filtro(x, tipo, f, ordem=2):
    return sosfilt(butter(ordem, f, btype=tipo, fs=SR, output='sos'), x)


def rosa(n, rng):
    # Ruído rosado por soma de ruídos suavizados.
    x = rng.standard_normal(n)
    for k in (4, 16, 64, 256):
        x += np.convolve(rng.standard_normal(n), np.ones(k) / k, 'same') * np.sqrt(k)
    return x / np.std(x)


def sino(base, dur=12.0, bat=0.45):
    t = np.arange(int(SR * dur)) / SR
    P = [(1.00, 1.00, 9.0), (2.00, 0.55, 6.0), (2.76, 0.38, 5.0), (4.07, 0.18, 3.5),
         (5.43, 0.10, 2.5), (6.80, 0.05, 2.0)]
    s = np.zeros_like(t)
    for r, a, dec in P:
        f = base * r
        s += a * np.exp(-t / dec) * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * (f + bat) * t))
    ataque = np.minimum(t / 0.012, 1)
    return s * ataque / np.max(np.abs(s))


def reverb(x, rng, seg=1.8, mistura=0.25):
    n = int(SR * seg)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t / (seg / 6.9))
    ir = filtro(ir, 'lowpass', 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    molhado = fftconvolve(x, ir)[:len(x)]
    return (1 - mistura) * x + mistura * molhado


# ---------- Maré: ondas que chegam devagar e se desfazem na areia ----------
def mare(rng):
    out = np.zeros((2, N))
    t0 = -4.0
    while t0 < TOTAL:
        dur = rng.uniform(7.5, 10.5)
        n = int(SR * (dur + 2))
        tt = np.arange(n) / SR
        sobe = rng.uniform(2.4, 3.4)
        env = np.where(tt < sobe, (tt / sobe) ** 2.2, np.exp(-(tt - sobe) / rng.uniform(1.6, 2.4)))
        brilho = np.where(tt < sobe, tt / sobe, np.exp(-(tt - sobe) / 1.2))
        ruido = rosa(n, rng)
        grave = filtro(ruido, 'lowpass', 500)
        espuma = filtro(filtro(ruido, 'highpass', 800), 'lowpass', 3000, 4)
        onda = grave * env * 0.9 + espuma * env * brilho * 0.45
        g = rng.uniform(0.7, 1.0)
        pan = rng.uniform(0.35, 0.65)
        i = int(t0 * SR)
        a, b = max(i, 0), min(i + n, N)
        if b > a:
            seg = onda[a - i:b - i] * g
            out[0, a:b] += seg * np.sqrt(1 - pan)
            out[1, a:b] += seg * np.sqrt(pan)
        t0 += dur * rng.uniform(0.75, 0.95)
    # fundo constante do mar ao longe
    fundo = filtro(rosa(N, rng), 'lowpass', 350) * 0.25
    out += fundo
    return out


# ---------- Brisa: vento leve entre as folhas ----------
def brisa(rng):
    out = np.zeros((2, N))
    for c in range(2):
        x = filtro(filtro(rosa(N, rng), 'highpass', 150), 'lowpass', 1400)
        onda = 0.55 + 0.25 * np.sin(2 * np.pi * T / rng.uniform(13, 19) + rng.uniform(0, 6)) \
            + 0.2 * np.sin(2 * np.pi * T / rng.uniform(5, 8) + rng.uniform(0, 6))
        out[c] = x * np.clip(onda, 0.1, None)
    return out


# ---------- Pássaros: assobios curtos, ao longe ----------
def nota(f0, f1, dur, rng, vibr=0.0):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    curva = f0 + (f1 - f0) * (0.5 - 0.5 * np.cos(np.pi * tt / dur))   # glissando suave
    curva *= 1 + vibr * np.sin(2 * np.pi * rng.uniform(22, 34) * tt)
    fase = 2 * np.pi * np.cumsum(curva) / SR
    s = np.sin(fase) + 0.12 * np.sin(2 * fase)
    env = np.sin(np.pi * tt / dur) ** 1.6
    return s * env


def canto_assobio(rng):
    # Frase melódica de 3 a 5 notas, como um sabiá distante.
    base = rng.uniform(2100, 2900)
    partes = []
    for _ in range(rng.integers(3, 6)):
        f0 = base * rng.choice([1.0, 1.12, 1.26, 0.89, 1.19])
        f1 = f0 * rng.uniform(0.9, 1.15)
        partes.append(nota(f0, f1, rng.uniform(0.12, 0.32), rng, vibr=rng.uniform(0, 0.012)))
        partes.append(np.zeros(int(SR * rng.uniform(0.05, 0.14))))
    return np.concatenate(partes)


def canto_piado(rng):
    # Dois a quatro piados curtos e descendentes.
    partes = []
    for _ in range(rng.integers(2, 5)):
        f0 = rng.uniform(5200, 6400)
        partes.append(nota(f0, f0 * rng.uniform(0.62, 0.75), rng.uniform(0.05, 0.08), rng))
        partes.append(np.zeros(int(SR * rng.uniform(0.08, 0.16))))
    return np.concatenate(partes) * 0.6


def canto_trinado(rng):
    # Trinado rápido e leve.
    f = rng.uniform(3600, 4600)
    partes = []
    for k in range(rng.integers(6, 12)):
        partes.append(nota(f * (1 - 0.01 * k), f * 0.93 * (1 - 0.01 * k), 0.035, rng))
        partes.append(np.zeros(int(SR * 0.025)))
    return np.concatenate(partes) * 0.5


def passaros(rng, densidade):
    out = np.zeros((2, N))
    tipos = [canto_assobio, canto_assobio, canto_piado, canto_trinado]
    t0 = ANTES + rng.uniform(1.0, 3.0)
    while t0 < ANTES + MINUTO - 1.5:
        canto = tipos[rng.integers(len(tipos))](rng)
        distancia = rng.uniform(0.25, 1.0)
        canto = filtro(canto, 'lowpass', 9000 - 4000 * distancia) * (0.9 - 0.55 * distancia)
        pan = rng.uniform(0.15, 0.85)
        i = int(t0 * SR)
        b = min(i + len(canto), N)
        out[0, i:b] += canto[:b - i] * np.sqrt(1 - pan)
        out[1, i:b] += canto[:b - i] * np.sqrt(pan)
        t0 += rng.uniform(2.0, 5.0) / densidade
    return out


def tacas():
    out = np.zeros((2, N))
    inicio = sino(220)
    fim = sino(220)
    for quando, s, g in ((ANTES, inicio, 0.30), (ANTES + MINUTO, fim, 0.30), (ANTES + MINUTO + 1.6, fim, 0.24)):
        i = int(quando * SR)
        b = min(i + len(s), N)
        out[:, i:b] += s[:b - i] * g
    return out


def nivel(x, alvo_rms):
    return x * alvo_rms / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def montar(nome, mix, saida, semente):
    rng = np.random.default_rng(semente)
    fundo = np.zeros((2, N))
    if mix.get('mare'):
        fundo += nivel(mare(rng), 0.07 * mix['mare'])
    if mix.get('brisa'):
        fundo += nivel(brisa(rng), 0.035 * mix['brisa'])
    if mix.get('passaros'):
        p = passaros(rng, mix.get('densidade', 1.0))
        p = np.vstack([reverb(p[0], rng), reverb(p[1], rng)])
        fundo += p * 0.22 * mix['passaros']
    # a paisagem entra junto com a taça e sai devagar depois do fim
    e = np.clip((T - (ANTES - 1.5)) / 3.0, 0, 1) * np.clip((ANTES + MINUTO + 5.0 - T) / 4.0, 0, 1)
    fundo *= e
    final = fundo + tacas()
    final = final / np.max(np.abs(final)) * 0.85
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        with wave.open(w, 'wb') as f:
            f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
            f.writeframes((final.T * 32767).astype('<i2').tobytes())
        # volume fixo (sem compressor automático): mede a sonoridade e ajusta para -20 LUFS
        med = subprocess.run(['ffmpeg', '-i', w, '-af', 'ebur128', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
        lufs = float([l for l in med.splitlines() if l.strip().startswith('I:')][-1].split()[1])
        ganho = min(-20.0 - lufs, -20 * np.log10(0.85 / 0.98))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-af', f'volume={ganho:.2f}dB',
                        '-ar', '44100', '-b:a', '128k', os.path.join(saida, nome)], check=True)


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(saida, exist_ok=True)
    montar('caminhada-A-mare-e-brisa.mp3', {'mare': 1.0, 'brisa': 0.8}, saida, 11)
    montar('caminhada-B-mare-brisa-e-passaros.mp3', {'mare': 0.85, 'brisa': 0.7, 'passaros': 0.8, 'densidade': 0.8}, saida, 12)
    montar('caminhada-C-bosque-passaros-e-brisa.mp3', {'brisa': 1.0, 'passaros': 1.0, 'densidade': 1.2}, saida, 13)
