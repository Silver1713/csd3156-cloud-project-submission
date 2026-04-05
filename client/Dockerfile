FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install


COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

ENV VITE_API_BASE_URL=http://BackendLoadBalancer-670460673.us-east-1.elb.amazonaws.com
ENV VITE_COGNITO_USER_POOL_ID=us-east-1_27jNmaE6r
ENV VITE_COGNITO_CLIENT_ID=1s499nc92hcomm1i57tnivmupk

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
