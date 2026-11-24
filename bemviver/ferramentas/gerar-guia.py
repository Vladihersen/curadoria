# Gera as trilhas do suspiro fisiológico guiado do app: um som LISO que acompanha o ar
# (sem toques, sem degraus e sem nota que desliza de altura), com passarinhos baixinho,
# ao longe, mais o tempo final de observação. Substitui a taça tibetana (24/11/2026).
#
#   1ª inspiração (3,5 s): um acorde suave de Sol maior nasce do silêncio e sobe,
#                   ficando mais forte e mais luminoso
#   2ª inspiração (1,5 s): o primeiro som recua quase até sumir e nasce um SEGUNDO som,
#                   mais agudo e brilhante, que sobe: "inspira novamente"
#   expiração (6 s): tudo desce devagar, escurecendo e se apagando até o silêncio
#
# Nos testes com o Vladimir: grave contínuo soou como "filme de terror", nota deslizando
# como "sirene", e toques em escada deixaram a respiração "picotada". Por isso aqui só o
# VOLUME e o número de vozes mudam; a afinação fica parada.
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


def acorde(notas, n, brilho):
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f, a in notas:
        for h in range(1, 5):
            s += a * brilho ** (h - 1) / h ** 1.5 * np.sin(2 * np.pi * f * h * t + 0.7 * h)
    return s / np.max(np.abs(s))


def envelopes(n, ciclos):
    """Duas vozes, cada uma com sua curva suave:
    base  (acorde médio)  : sobe na 1ª inspiração e, no fim dela, recua rápido quase até
                            sumir, deixando um respiro de silêncio
    alta  (acorde agudo)  : nasce sozinha na 2ª inspiração, como um segundo som
    na expiração as duas se juntam e descem devagar até o silêncio."""
    base = np.zeros(n); alta = np.zeros(n); luz = np.zeros(n)
    t = ENTRADA
    for _ in range(ciclos):
        for nome, d in FASES:
            i, j = int(t * SR), int((t + d) * SR)
            u = np.arange(j - i) / (j - i); tt = u * d
            if nome == "inspira":
                sobe = np.sin(np.pi / 2 * np.minimum(tt / (d - 0.35), 1)) ** 1.4
                cai = np.clip((d - tt) / 0.35, 0, 1) ** 1.5       # recua nos últimos 0,35 s
                base[i:j] = 0.8 * sobe * (0.12 + 0.88 * cai)
                luz[i:j] = 0.5 * u
            elif nome == "inspira2":
                liso = 0.5 - 0.5 * np.cos(np.pi * u)
                alta[i:j] = liso
                base[i:j] = 0.8 * 0.12 + 0.5 * liso ** 2           # a base volta só no fim, por baixo
                luz[i:j] = 0.5 + 0.5 * liso
            else:
                desce = 1 - (0.5 - 0.5 * np.cos(np.pi * u ** 0.85))
                base[i:j] = (0.6 + 0.2 * np.minimum(u / 0.15, 1)) * desce
                alta[i:j] = desce * (1 - 0.5 * u)
                luz[i:j] = desce
            t += d
    k = int(0.03 * SR)
    base = np.convolve(base, np.ones(k) / k, 'same'); alta = np.convolve(alta, np.ones(k) / k, 'same')
    return base, alta, luz, t


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
    base, alta, luz, fim = envelopes(n, ciclos)
    # depois do último ciclo, o acorde volta uma vez, longo, e abre a observação
    tt = np.arange(n) / SR
    k = tt >= fim + 0.3
    u = tt[k] - (fim + 0.3)
    base[k] = np.minimum(u / 2.5, 1) ** 2 * np.exp(-np.maximum(u - 2.5, 0) / 3.0) * 0.8
    escuro = acorde([(D4, 0.7), (G4, 1.0), (B4, 0.6)], n, 0.15)
    claro = acorde([(D4, 0.7), (G4, 1.0), (B4, 0.6)], n, 0.55)
    voz_base = ((1 - luz) * escuro + luz * claro) * base ** 1.3
    voz_alta = acorde([(B4, 0.5), (D5, 0.9), (G5, 0.7)], n, 0.3) * alta ** 1.2
    guia = filtro(voz_base + 0.9 * voz_alta, 'lowpass', 2500)
    guia = eco(guia, rng, 2.2, 0.3)
    aves = passaros(n, rng)
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
