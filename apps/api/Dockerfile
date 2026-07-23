FROM python:3.12-slim

WORKDIR /workspace
COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt
COPY apps apps

EXPOSE 8088
CMD ["python", "-m", "apps.api.main"]
