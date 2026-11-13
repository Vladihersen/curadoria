# Gera as trilhas do suspiro fisiológico guiado do app: taça tibetana no ritmo de cada
# fase (o mesmo som-guia dos áudios gravados e do Leveza de Viver) + paisagem sonora
# de brisa, mais o tempo final de observação.
#
#   python3 gerar-guia.py   -> public/bemviver/audio/guia-1-minuto.mp3 e guia-5-minutos.mp3
#
# A tela do app lê o mesmo roteiro (CONDUCAO em app.js): se mudar um tempo aqui,
# mude lá também.
import numpy as np, subprocess, tempfile, os, wave

SR = 44100
ENTRADA = 4.0            # sente-se, deixe o corpo pesar
FASES = [("inspira", 2.4), ("inspira2", 1.5), ("solta", 5.5)]  # 9,4 s por ciclo
CICLO = sum(d for _, d in FASES)
OBSERVAR = 30.0          # depois do último ciclo: observar-se e reconhecer a mudança

def sino(base, dur=15.0, bat=0.45):
    t = np.arange(int(SR * dur)) / SR
    P = [(1.00, 1.00, 15.0), (2.00, 0.60, 10.0), (2.76, 0.42, 8.0), (4.07, 0.20, 5.5),
         (5.43, 0.12, 4.0), (6.80, 0.07, 3.0), (8.20, 0.03, 2.2)]
    s = np.zeros_like(t)
    for r, a, dec in P:
        f = base * r
        s += a * np.exp(-t / dec) * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * (f + bat) * t))
    return s * np.minimum(t / 0.01, 1) * 0.24

SOBE, DESCE = sino(262), sino(196)

def reamostra(buf, taxa, n):
    idx = np.arange(n) * taxa
    idx = idx[idx < len(buf) - 1]
    return np.interp(idx, np.arange(len(buf)), buf)

def envelope(n, ataque, corte):
    t = np.arange(n) / SR
    e = np.ones(n)
    a = t < ataque
    e[a] = 0.05 * (1 / 0.05) ** (t[a] / ataque)
    fs = corte - 0.5
    f = t >= fs
    e[f] = (1e-4) ** np.clip((t[f] - fs) / (corte - fs), 0, 1)
    return e

def brisa(dur, semente=7):
    # Ruído rosado suave, filtrado e com ondas lentas, como vento entre as folhas.
    rng = np.random.default_rng(semente)
    n = int(SR * dur)
    br = np.cumsum(rng.standard_normal(n)); br -= np.convolve(br, np.ones(SR) / SR, 'same')  # marrom sem deriva
    rosa = rng.standard_normal(n)
    for k in (8, 32, 128):
        rosa += np.convolve(rng.standard_normal(n), np.ones(k) / k, 'same') * np.sqrt(k)
    s = br / np.std(br) * 0.7 + rosa / np.std(rosa) * 0.3
    # passa-baixas simples (~700 Hz)
    a = np.exp(-2 * np.pi * 700 / SR)
    y = np.empty_like(s); acc = 0.0
    for i in range(n):  # loop simples, roda uma vez só
        acc = a * acc + (1 - a) * s[i]; y[i] = acc
    t = np.arange(n) / SR
    onda = 0.75 + 0.15 * np.sin(2 * np.pi * t / 23 + 1) + 0.10 * np.sin(2 * np.pi * t / 11.3)
    return y / np.std(y) * onda

def trilha(ciclos):
    total = ENTRADA + ciclos * CICLO + OBSERVAR
    out = np.zeros(int(SR * (total + 1)))
    def soma(sig, quando, ganho=1.0):
        i = int(quando * SR); j = min(len(out), i + len(sig)); out[i:j] += sig[:j - i] * ganho
    t = ENTRADA
    for _ in range(ciclos):
        for nome, d in FASES:
            corte = d + 0.45; m = int(corte * SR)
            if nome == "inspira":  soma(reamostra(SOBE, 1.00, m) * envelope(m, 0.40, corte), t)
            if nome == "inspira2": soma(reamostra(SOBE, 1.03, m) * envelope(m, 0.22, corte), t)
            if nome == "solta":    soma(reamostra(DESCE, 1.00, m) * envelope(m, 0.15, corte), t)
            t += d
    # Fim da respiração: um toque longo da taça abre o tempo de observação.
    soma(DESCE * 0.8, t + 0.3)
    taca = out / np.max(np.abs(out)) * 0.62
    vento = brisa(len(out) / SR)[:len(out)]
    tt = np.arange(len(out)) / SR
    fade = np.clip(tt / 3, 0, 1) * np.clip((total + 1 - tt) / 6, 0, 1)
    mix = taca + vento * 0.055 * fade
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
