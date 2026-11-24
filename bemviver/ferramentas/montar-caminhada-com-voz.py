import sys, os, wave, subprocess, tempfile, numpy as np, importlib.util
FERR, PAIS, LIMPO, SAIDA = sys.argv[1:5]
spec = importlib.util.spec_from_file_location('g', os.path.join(FERR, 'gerar-caminhada.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
SR = 44100
def ler(p, canais):
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-ac', str(canais), '-ar', str(SR), w], check=True)
        f = wave.open(w); x = np.frombuffer(f.readframes(f.getnframes()), '<i2') / 32768.0
    return x.reshape(-1, canais).T
voz = ler(LIMPO, 1)[0]
def trecho(a, b):
    s = voz[int(a * SR):int(b * SR)].copy(); n = int(0.08 * SR)
    s[:n] *= np.linspace(0, 1, n); s[-n:] *= np.linspace(1, 0, n); return s
INI = trecho(0.95, 4.60)   # "Vamos caminhar. Um minuto, começando agora."
FIM = trecho(7.10, 10.45)  # "Terminamos. Um minuto de caminhada."
V_INI, TACA_INI = 0.8, 0.8 + len(INI) / SR + 0.35   # a taça soa logo depois do "agora"
TACA_FIM = TACA_INI + 60.0
V_FIM = TACA_FIM + 2.2
TOTAL = V_FIM + len(FIM) / SR + 4.0
N = int(TOTAL * SR); T = np.arange(N) / SR
pais = np.zeros((2, N)); p = ler(PAIS, 2); n = min(N, p.shape[1]); pais[:, :n] = p[:, :n]
def pim(f=523.25, dur=6.0, queda=1.7):
    # Um "pim" limpo, como um sininho: tom puro, sem o batimento da taça.
    # queda = quanto tempo o som leva para sumir (menor = mais curto).
    t = np.arange(int(SR * dur)) / SR
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.exp(-t / 0.6) * np.sin(2 * np.pi * 2 * f * t) + 0.06 * np.exp(-t / 0.3) * np.sin(2 * np.pi * 3.01 * f * t)
    fim = np.clip((dur - t) / 0.15, 0, 1)  # termina sem estalo
    return x * np.exp(-t / queda) * np.minimum(t / 0.004, 1) * fim

# 24/11: o pim do início ficou longo demais (soava uns 5 s). Agora ele é curto,
# some em pouco mais de 1 s; o pim do fim continua longo, fechando a caminhada.
PIM_INICIO = dict(dur=1.4, queda=0.30)
PIM_FIM = dict(dur=6.0, queda=1.7)

def longe(x):
    # som ao longe: tira o brilho (agudos) e um pouco do grave
    return np.vstack([g.filtro(g.filtro(c, 'lowpass', 3500, 4), 'highpass', 120) for c in x])

def montar(nome, fundo):
    # paisagem: entra baixinho sob a voz, cresce com a taça, abaixa sob a fala final e some
    env = np.interp(T, [0, V_INI, TACA_INI, TACA_INI + 2.5, TACA_FIM, V_FIM - 0.3, V_FIM + len(FIM) / SR, TOTAL],
                    [0, 0.30, 0.35, 1.0, 1.0, 0.35, 0.30, 0])
    out = g.nivel(fundo, 0.018) * env
    for quando, s in ((TACA_INI, pim(**PIM_INICIO)), (TACA_FIM, pim(**PIM_FIM))):
        i = int(quando * SR); b = min(N, i + len(s)); out[:, i:b] += s[:b - i] * 0.36
    vrms = 0.20
    for quando, v in ((V_INI, INI), (V_FIM, FIM)):
        v = v * vrms / np.sqrt(np.mean(v[np.abs(v) > 0.01] ** 2)); i = int(quando * SR); out[:, i:i + len(v)] += v
    out = out / np.max(np.abs(out)) * 0.9
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        with wave.open(w, 'wb') as f:
            f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((out.T * 32767).astype('<i2').tobytes())
        med = subprocess.run(['ffmpeg', '-i', w, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
        lufs = float([l for l in med.splitlines() if l.strip().startswith('I:')][-1].split()[1])
        ganho = min(-17.0 - lufs, 20 * np.log10(0.89 / 0.9))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-af', f'volume={ganho:.2f}dB', '-b:a', '128k', os.path.join(SAIDA, nome)], check=True)
    print(nome, round(TOTAL, 1), 's; taça início', round(TACA_INI, 1), 'fim', round(TACA_FIM, 1))
mar = g.mare(np.random.default_rng(21))
mar = mar[:, :N] if mar.shape[1] >= N else np.pad(mar, ((0, 0), (0, N - mar.shape[1])))
mar = np.vstack([g.filtro(c, 'lowpass', 900, 4) for c in mar])
montar('6-caminhada-1-minuto.mp3', longe(g.nivel(pais, 0.08) + g.nivel(mar, 0.018)))
