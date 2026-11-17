#!/bin/bash
# proc.sh ENTRADA SAIDA FADE_OUT_INICIO
in=$1; out=$2
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
fo=$(python3 -c "print(round($dur-3.5,2))")
CH="highpass=f=90,afftdn=nr=12:nf=-38:tn=1,equalizer=f=220:t=q:w=1:g=-2.5,equalizer=f=3200:t=q:w=1.2:g=2,equalizer=f=7500:t=q:w=1:g=-1.5,lowpass=f=12000,acompressor=threshold=-22dB:ratio=2:attack=20:release=250:makeup=1,aecho=0.8:0.6:45|90:0.12|0.07,afade=t=in:d=2,afade=t=out:st=$fo:d=3.5"
ffmpeg -loglevel error -y -i "$in" -vn -af "$CH" -ar 44100 -ac 2 tmp.wav
L=$(ffmpeg -i tmp.wav -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
G=$(python3 -c "print(round(-17.5-($L),2))")
ffmpeg -loglevel error -y -i tmp.wav -af "volume=${G}dB,alimiter=limit=0.89:level=false" -ar 44100 -b:a 128k "$out"
echo "$out $(ffmpeg -i "$out" -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1)"
