FROM node:22-alpine

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY apps/web apps/web

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
