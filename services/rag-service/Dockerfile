FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    TRANSFORMERS_CACHE=/models/transformers

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
    # && python -m nltk.downloader punkt punkt_tab

COPY . .
RUN mkdir -p /app/uploads /app/data

EXPOSE 5000

CMD ["python", "app.py"]
