FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.0.0+cpu torchvision==0.15.0+cpu --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN pip install --no-cache-dir huggingface_hub && python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='Ariak-25/tfd-model', filename='deepfake_video_model.pth', local_dir='.')"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

