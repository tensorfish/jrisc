"""Reproducible 30s / 14s square edits from real browser recordings. Requires FFmpeg."""
from pathlib import Path
import subprocess,json
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'artifacts/raw'; OUT=ROOT/'artifacts'
FFMPEG=subprocess.check_output(['node','-p',"require('ffmpeg-static')"],cwd=ROOT,text=True).strip()
FFPROBE=subprocess.check_output(['node','-p',"require('ffprobe-static').path"],cwd=ROOT,text=True).strip()
def run(args):
 subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(p):
 return float(subprocess.check_output([FFPROBE,'-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)]))
shots=json.loads((RAW/'edit.json').read_text())
for s in shots:
 ident=s['id'];start=max(0,duration(RAW/f'{ident}.webm')-s['duration']-.1)
 run([FFMPEG,'-y','-ss',str(start),'-i',str(RAW/f'{ident}.webm'),'-loop','1','-i',str(RAW/f'{ident}-overlay.png'),'-filter_complex','[0:v]fps=30,scale=1080:780,pad=1080:1080:0:205:color=0x10140e[base];[base][1:v]overlay=0:0,format=yuv420p[v]','-map','[v]','-t',str(s['duration']),'-an','-c:v','libx264','-preset','fast','-crf','18','-movflags','+faststart',str(RAW/f'{ident}.mp4')])
( RAW/'main-list.txt').write_text(''.join("file '"+str(RAW/(s['id']+'.mp4'))+"'\n" for s in shots))
run([FFMPEG,'-y','-f','concat','-safe','0','-i',str(RAW/'main-list.txt'),'-c','copy','-movflags','+faststart',str(OUT/'jrisc-main.mp4')])
# Straight cuts, no time compression. Select the response portions of the same recordings.
clips=[('hook',0,3),('batch',1,4),('twist',2,4),('end',1,3)]
for i,(ident,start,length) in enumerate(clips):
 run([FFMPEG,'-y','-ss',str(start),'-i',str(RAW/f'{ident}.mp4'),'-t',str(length),'-an','-c:v','libx264','-preset','fast','-crf','18',str(RAW/f'cut-{i}.mp4')])
(RAW/'cut-list.txt').write_text(''.join("file '"+str(RAW/f'cut-{i}.mp4')+"'\n" for i in range(len(clips))))
run([FFMPEG,'-y','-f','concat','-safe','0','-i',str(RAW/'cut-list.txt'),'-c','copy','-movflags','+faststart',str(OUT/'jrisc-cutdown.mp4')])
run([FFMPEG,'-y','-ss','2.6','-i',str(OUT/'jrisc-main.mp4'),'-frames:v','1',str(OUT/'thumbnail.png')])
for name in ['jrisc-main.mp4','jrisc-cutdown.mp4']:
 print(name,duration(OUT/name),'seconds',round((OUT/name).stat().st_size/1024/1024,2),'MB')
