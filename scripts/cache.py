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
species={int(r["id"]):r for r in rows("pokemon_species")}
regions=["","kanto","johto","hoenn","sinnoh","unova","kalos","alola","galar","paldea"]
def region_of(number):
    if number in (808,809): return "unknown"
    if 899 <= number <= 905: return "hisui"
    if 1011 <= number <= 1017 or number==1025: return "kitakami"
    return regions[int(species[number]["generation_id"])]
dex={}
for r in rows("pokemon"):
    i,b=int(r["id"]),int(r["species_id"])
    if i not in forms and (i!=b or i>1025):continue
    en=names[b]["9"]
    if i in forms: en=("Mega "+en+" "+r["identifier"].split("-mega")[-1].strip("-").upper()).strip()
    dex[i]=dict(id=i,dex=b,name=forms.get(i,names[b]["3"]),en=en,region=region_of(b),legendary=species[b]["is_legendary"]=="1",mythical=species[b]["is_mythical"]=="1",stats=[0]*6,types=[],moves=[])
for r in rows("pokemon_stats"):
    i=int(r["pokemon_id"])
    if i in dex: dex[i]["stats"][int(r["stat_id"])-1]=int(r["base_stat"])
for r in rows("pokemon_types"):
    i=int(r["pokemon_id"])
    if i in dex: dex[i]["types"].append(int(r["type_id"]))
mn={int(r["move_id"]):r["name"] for r in rows("move_names") if r["local_language_id"]=="3"}
en_moves={int(r["move_id"]):r["name"] for r in rows("move_names") if r["local_language_id"]=="9"}
moves={}
for r in rows("moves"):
    i=int(r["id"])
    if i in mn and int(r["type_id"])<=18:
        moves[i]=dict(name=mn[i],en=en_moves[i],type=int(r["type_id"]),power=int(r["power"] or 0),accuracy=int(r["accuracy"] or 100),category=int(r["damage_class_id"]),priority=int(r["priority"]),pp=int(r["pp"] or 1))
# Use one turn-based game family per species; expansions share their base learnset.
families=[(25,26,27),(20,21,22),(23,),(18,),(17,),(16,),(15,)]
family={version:i for i,group in enumerate(families) for version in group}
learn=defaultdict(lambda:defaultdict(dict))
for r in rows("pokemon_moves"):
    i,m=int(r["pokemon_id"]),int(r["move_id"])
    version=int(r["version_group_id"])
    method=int(r["pokemon_move_method_id"])
    if i not in dex or m not in moves or version not in family or method not in (1,2,3,4): continue
    if method==1 and int(r["level"])>50: continue
    pool=learn[i][family[version]]
    pool[m]=max(pool.get(m,0),18 if method==1 else 0)
signatures={25:[85,98,231],6:[53,403,337],7:[55,44,229],150:[540,94],643:[551,406],129:[33,175,150],132:[144],202:[68,243,219,194]}
# These moves require unavailable equipment or allies, immediately end the match,
# or have impractical prerequisites for a four-move single battle.
exclude_attacks={12,32,90,120,138,153,206,329,387,515,562,668,690,775,798,802,809}
for i,p in dex.items():
    groups=learn[p["dex"]]
    if not groups: raise ValueError(("no level-50 learnset",i,p["name"]))
    game=min(groups)
    pool=groups[game]
    p["learnsetGroup"]=families[game][0]
    def score(m):
        a=moves[m]
        power=min(105,a["power"])
        if m in (76,63,416,19,91,143,200,264,340,566,338,307,308):power*=.55
        return pool[m]+power*a["accuracy"]/100+25*(a["type"] in p["types"])+10*((a["category"]==2)==(p["stats"][1]>p["stats"][3]))
    attacks=sorted((m for m in pool if moves[m]["power"] and m not in exclude_attacks),key=lambda m:(score(m),-m),reverse=True)
    selected=[m for m in signatures.get(p["dex"],[]) if m in pool]
    for m in attacks:
        if len(selected)<4 and all(moves[v]["type"]!=moves[m]["type"] for v in selected):selected.append(m)
    selected=(selected+[m for m in attacks if m not in selected])[:4]
    if len(selected)<3:selected += [m for m in sorted(pool) if m not in selected][:3-len(selected)]
    p["moves"]=selected or [165]
chart=[[1]*18 for i in range(18)]
for r in rows("type_efficacy"):
    a,b=int(r["damage_type_id"]),int(r["target_type_id"])
    if max(a,b)<=18: chart[a-1][b-1]=int(r["damage_factor"])/100
assert len(dex)==1073 and all(all(p["stats"]) and p["types"] for p in dex.values())
# Numeric IDs present in PokeAPI's pinned Showdown front/back GIF directories.
# Keep builds independent of API directory listings. Forms without a sprite use cached card art.
def in_ranges(i,ranges):
    return any(start<=i<=end for start,end in ranges)
front_sprites=[(1, 989), (996, 1005), (1007, 1007), (1009, 1009), (1011, 1016), (1018, 1021), (10001, 10256), (10258, 10263), (10272, 10272), (10278, 10286)]
back_sprites=[(1, 989), (996, 1005), (1007, 1007), (1009, 1009), (1011, 1016), (1018, 1021), (10001, 10083), (10085, 10194), (10196, 10196), (10198, 10208), (10212, 10225), (10228, 10256), (10258, 10263), (10272, 10272), (10278, 10286)]
for i,p in dex.items():
    p["battleFront"]=in_ranges(i,front_sprites)
    p["battleBack"]=in_ranges(i,back_sprites)
(out/"dex.json").write_text(json.dumps(dict(pokemon=list(dex.values()),moves=moves,chart=chart),ensure_ascii=False,separators=(",",":")))
def art(i):
    fetch(f"https://raw.githubusercontent.com/PokeAPI/sprites/c0542f7c51215d9672439012838c99f520596cbd/sprites/pokemon/other/official-artwork/{i}.png",out/"art"/f"{i}.png",b"\x89PNG\r\n\x1a\n")
    for folder,key,prefix in [("front","battleFront",""),("back","battleBack","back/")]:
        if dex[i][key]:
            fetch(f"https://raw.githubusercontent.com/PokeAPI/sprites/c0542f7c51215d9672439012838c99f520596cbd/sprites/pokemon/other/showdown/{prefix}{i}.gif",out/"fighters"/folder/f"{i}.gif",b"GIF")
with ThreadPoolExecutor(max_workers=18) as workers: list(workers.map(art,dex))
fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2",out/"pretendard.woff2",b"wOF2")
fetch("https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE",out/"font-license.txt")
print("1025 species, 48 Mega forms and 1073 images cached")

# Bundle the illustrated arena and throw poses with the existing local artwork.
stage=out/"stage"
client="https://raw.githubusercontent.com/smogon/pokemon-showdown-client/24c266052dbe037322c8b84a2d99b0085839e3bd/play.pokemonshowdown.com/fx/"
trainers="https://raw.githubusercontent.com/pret/pokeemerald/8cf518839e529eeb2477905ede1df7213ac134b8/graphics/trainers/back_pics/"
for url in [client+"bg-meadow.png",trainers+"red.png",trainers+"brendan.png"]:
    fetch(url,stage/url.rsplit("/",1)[1],b"\x89PNG\r\n\x1a\n")
