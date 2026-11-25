FROM python:3.12-slim AS assets
WORKDIR /build
COPY scripts/cache.py scripts/cache.py
RUN python scripts/cache.py

FROM python:3.12-slim AS model
WORKDIR /model
COPY scripts/model.py .
RUN python model.py

FROM node:22-bookworm-slim
WORKDIR /game
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libcurl4 espeak-ng && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=model /model/build/bin /model/bin
COPY --from=model /model/friend.gguf /model/friend.gguf
COPY --from=assets /build/public/ public/
COPY public/ public/
COPY index.html server.js friend.js visitors.js narration.js simulator.js forecasts.js package.json ./
ENV FRIEND_BINARY=/model/bin/llama-server FRIEND_MODEL=/model/friend.gguf
CMD ["node","server.js"]
