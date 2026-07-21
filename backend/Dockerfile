# Use an official lightweight Python image
FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffer stdout/stderr for real-time logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies (needed for compiling C-extensions if using numpy/scipy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy application source code
COPY . .

# Expose container port
EXPOSE 8000

# Run Gunicorn with Uvicorn async workers for production scaling
CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker --preload -w ${WORKERS:-1} -b 0.0.0.0:${PORT:-10000} app.main:app"]
