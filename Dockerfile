FROM python:3.12-slim AS assets
WORKDIR /build
COPY scripts/cache.py scripts/cache.py
RUN python scripts/cache.py

FROM python:3.12-slim AS model
WORKDIR /model
COPY scripts/model.py .
RUN python model.py

FROM mcr.microsoft.com/playwright:v1.55.0-noble AS preview
WORKDIR /game
RUN npm install --no-save --ignore-scripts playwright@1.55.0
COPY . .
COPY --from=assets /build/public/ public/
RUN npm test && node test/browser.cjs && touch /tmp/verified

FROM node:22-bookworm-slim
WORKDIR /game
COPY --from=preview /tmp/verified /tmp/verified
COPY --from=model /model/build/bin /model/bin
COPY --from=model /model/friend.gguf /model/friend.gguf
COPY --from=assets /build/public/ public/
COPY public/ public/
COPY index.html server.js friend.js package.json ./
ENV FRIEND_BINARY=/model/bin/llama-server FRIEND_MODEL=/model/friend.gguf
CMD ["node","server.js"]
