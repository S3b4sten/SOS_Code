FROM python:3.11-slim

WORKDIR /app

# Requis pour OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Le modèle yolo sera téléchargé au premier run, mais on peut forcer son d/l ici si besoin
# RUN python -c "from ultralytics import YOLO; YOLO('yolov8n-seg.pt')"

COPY . .

EXPOSE 8501

HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
