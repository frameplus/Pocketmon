from urllib.request import urlopen
from pathlib import Path
import hashlib, shutil, zipfile
def get(url, file, digest):
    print("Preparing",file,flush=True)
    with urlopen(url,timeout=180) as response,open(file,"wb") as target: shutil.copyfileobj(response,target)
    with open(file,"rb") as source: assert hashlib.file_digest(source,"sha256").hexdigest()==digest
get("https://github.com/ggml-org/llama.cpp/releases/download/b6690/llama-b6690-bin-ubuntu-x64.zip","llama.zip","d93974ae599417e8dc4ba3fbbdcd050855f8cabe0ba60150a27b0a81ded8ba50")
with zipfile.ZipFile("llama.zip") as z: z.extractall()
Path("build/bin/llama-server").chmod(0o755)
# The Ollama registry provides a second distribution channel for the same local model family.
# Verify the registry's content-addressed layer and fall back to the pinned upstream GGUF.
import json
from urllib.request import Request
try:
    with urlopen(Request("https://registry.ollama.ai/v2/library/qwen2.5/manifests/0.5b",headers={"Accept":"application/vnd.docker.distribution.manifest.v2+json"}),timeout=25) as response:
        manifest=json.load(response)
    layer=next(l for l in manifest["layers"] if l["mediaType"]=="application/vnd.ollama.image.model")
    assert 200_000_000 < layer["size"] < 700_000_000
    print("Downloading the verified local model layer",layer["digest"],flush=True)
    get("https://registry.ollama.ai/v2/library/qwen2.5/blobs/"+layer["digest"],"friend.gguf",layer["digest"].split(":")[1])
except Exception as error:
    print("Using the pinned upstream GGUF",type(error).__name__,flush=True)
    get("https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf","friend.gguf","74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db")
