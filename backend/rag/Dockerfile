# backend/rag/Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model at build time so the first request is fast.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# CHANGED: make the entrypoint script runnable.
RUN chmod +x start.sh

EXPOSE 5000

# CHANGED: run start.sh instead of gunicorn directly. start.sh launches the 4 live
# updaters in the background AND then runs gunicorn, so the live index stays fresh.
CMD ["bash", "start.sh"]# backend/rag/Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model at build time so the first request is fast.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# CHANGED: make the entrypoint script runnable.
RUN chmod +x start.sh

EXPOSE 5000

# CHANGED: run start.sh instead of gunicorn directly. start.sh launches the 4 live
# updaters in the background AND then runs gunicorn, so the live index stays fresh.
CMD ["bash", "start.sh"]