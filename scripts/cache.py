"""Cache a pinned PokeAPI snapshot and its official artwork in the deployable image."""
import csv, json, time, shutil
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
out=Path("public")
out.mkdir(exist_ok=True)
cache=Path("/tmp/pokedata")
cache.mkdir(exist_ok=True)
def fetch(url,dst,signature=None):
    if dst.exists(): return
    dst.parent.mkdir(parents=True,exist_ok=True)
    for i in range(5):
        tmp=dst.with_suffix(".part")
        try:
            with urlopen(url,timeout=60) as response, tmp.open("wb") as f: shutil.copyfileobj(response,f)
            if signature:
                with tmp.open("rb") as f: assert f.read(len(signature))==signature
            tmp.replace(dst)
            return
        except Exception:
            if i==4: raise
            time.sleep(i+1)
def rows(name):
    f=cache/(name+".csv")
    fetch("https://raw.githubusercontent.com/PokeAPI/pokeapi/de6760be38b60a3024f1d9054330ff265f0dc619/data/v2/csv/"+f.name,f)
    with f.open(encoding="utf8",newline="") as file: yield from csv.DictReader(file)
names=defaultdict(dict)
for r in rows("pokemon_species_names"):
    if r["local_language_id"] in ["3","9"]: names[int(r["pokemon_species_id"])][r["local_language_id"]]=r["name"]
forms_ko={r["pokemon_form_id"]:r["form_name"] for r in rows("pokemon_form_names") if r["local_language_id"]=="3"}
forms={int(r["pokemon_id"]):forms_ko[r["id"]] for r in rows("pokemon_forms") if r["is_mega"]=="1" and r["introduced_in_version_group_id"] in ["15","16"]}
dex={}
for r in rows("pokemon"):
    i,b=int(r["id"]),int(r["species_id"])
    if i not in forms and (i!=b or i>1025):continue
    en=names[b]["9"]
    if i in forms: en=("Mega "+en+" "+r["identifier"].split("-mega")[-1].strip("-").upper()).strip()
    dex[i]=dict(id=i,dex=b,name=forms.get(i,names[b]["3"]),en=en,stats=[0]*6,types=[],moves=[])
for r in rows("pokemon_stats"):
    i=int(r["pokemon_id"])
    if i in dex: dex[i]["stats"][int(r["stat_id"])-1]=int(r["base_stat"])
for r in rows("pokemon_types"):
    i=int(r["pokemon_id"])
    if i in dex: dex[i]["types"].append(int(r["type_id"]))
mn={int(r["move_id"]):r["name"] for r in rows("move_names") if r["local_language_id"]=="3"}
moves={}
for r in rows("moves"):
    i=int(r["id"])
    if i in mn and int(r["type_id"])<=18:
        moves[i]=dict(name=mn[i],type=int(r["type_id"]),power=int(r["power"] or 0),accuracy=int(r["accuracy"] or 100),category=int(r["damage_class_id"]),priority=int(r["priority"]),pp=int(r["pp"] or 1))
learn=defaultdict(dict)
for r in rows("pokemon_moves"):
    i,m=int(r["pokemon_id"]),int(r["move_id"])
    if i in dex and m in moves and r["pokemon_move_method_id"] in ["1","2","3","4"]:
        learn[i][m]=max(learn[i].get(m,0),18*(r["pokemon_move_method_id"]=="1")+min(25,int(r["version_group_id"]))/5)
signatures={25:[85,98,231],6:[53,403,337],7:[55,44,229],150:[540,94],643:[551,406]}
used={165}
for i,p in dex.items():
    pool=learn[p["dex"]]|learn[i]
    def score(m):
        a=moves[m]
        return pool[m]+min(100,a["power"])*a["accuracy"]/100+25*(a["type"] in p["types"])+10*((a["category"]==2)==(p["stats"][1]>p["stats"][3]))
    attacks=sorted((m for m in pool if moves[m]["power"] and m not in [120,153,515,802,206,12,32,90,329,138]),key=lambda m:(score(m),-m),reverse=True)
    selected=[m for m in signatures.get(p["dex"],[]) if m in attacks]
    for m in attacks:
        if len(selected)<4 and all(moves[v]["type"]!=moves[m]["type"] for v in selected):selected.append(m)
    selected=(selected+[m for m in attacks if m not in selected])[:4]
    if len(selected)<3:selected += [m for m in sorted(pool) if moves[m]["category"]==1][:3-len(selected)]
    p["moves"]=selected or [165]
    used.update(p["moves"])
chart=[[1]*18 for i in range(18)]
for r in rows("type_efficacy"):
    a,b=int(r["damage_type_id"]),int(r["target_type_id"])
    if max(a,b)<=18: chart[a-1][b-1]=int(r["damage_factor"])/100
assert len(dex)==1073 and all(all(p["stats"]) and p["types"] for p in dex.values())
(out/"dex.json").write_text(json.dumps(dict(pokemon=list(dex.values()),moves={i:moves[i] for i in sorted(used)},chart=chart),ensure_ascii=False,separators=(",",":")))
def art(i):
    fetch(f"https://raw.githubusercontent.com/PokeAPI/sprites/c0542f7c51215d9672439012838c99f520596cbd/sprites/pokemon/other/official-artwork/{i}.png",out/"art"/f"{i}.png",b"\x89PNG\r\n\x1a\n")
with ThreadPoolExecutor(max_workers=18) as workers: list(workers.map(art,dex))
fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2",out/"pretendard.woff2",b"wOF2")
fetch("https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE",out/"font-license.txt")
print("1025 species, 48 Mega forms and 1073 images cached")
