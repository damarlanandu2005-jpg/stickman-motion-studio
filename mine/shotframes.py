import json,re,sys
proj=sys.argv[1]
w=json.load(open(proj+'/work/words.json')); ph=json.load(open(proj+'/work/phrases.json'))
total=round(ph['duration']*30)
notes=open(proj+'/shot_notes.txt').read()
shots=re.findall(r'SHOT (\d+) \(([^)]+)\)\s*\nWORDS:\s*"(.*?)"',notes)
i=0;out=[]
for n,id_,words in shots:
    k=len(words.split()); out.append((re.sub(r'\W+','',id_)+n,round(w[i]['s']*30), words)); i+=k
res=[]
for j,(id_,a,words) in enumerate(out):
    b=(out[j+1][1]-1) if j+1<len(out) else total-1
    res.append((id_,a,b))
print('TOTAL',total,'words',len(w),'consumed',i)
print(', '.join(f"{{ id: '{id_}', a: {a}, b: {b} }}" for id_,a,b in res))
for id_,a,b in res: print(f"  {id_:10s} {a:4d}-{b:4d} ({(b-a+1)/30:.1f}s)")
