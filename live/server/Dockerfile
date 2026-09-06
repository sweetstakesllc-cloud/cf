FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY requirements.txt ./
RUN python3 -m venv /opt/pdf && /opt/pdf/bin/pip install --no-cache-dir -r requirements.txt
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
ENV NODE_ENV=production CERTIFICATE_PYTHON_BIN=/opt/pdf/bin/python CERTIFICATE_STORAGE_DIR=/data/certificates
CMD ["node", "--import", "tsx", "src/certificates/index.ts"]
