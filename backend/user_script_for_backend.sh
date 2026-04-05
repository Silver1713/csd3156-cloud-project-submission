#!/bin/bash
set -Eeuo pipefail

exec > >(tee /var/log/user-data.log) 2>&1

AWS_REGION="us-east-1"
CLIENT_SECRET_ID="ClientSecret"

ECR_REGISTRY="484633104778.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_IMAGE="${ECR_REGISTRY}/indigo-ledger/client:v5"

echo "Starting EC2 bootstrap"

# ===== SYSTEM SETUP =====
yum update -y
yum install -y aws-cli jq docker

systemctl enable docker
systemctl start docker

id ec2-user >/dev/null 2>&1 && usermod -aG docker ec2-user || true

# ===== WAIT FOR DOCKER =====
for i in {1..30}; do
  if systemctl is-active --quiet docker; then
    echo "Docker is ready"
    break
  fi
  echo "Waiting for Docker... ($i)"
  sleep 2
done

if ! systemctl is-active --quiet docker; then
  echo "Docker failed to start"
  exit 1
fi

# ===== WAIT FOR IAM ROLE =====
for i in {1..30}; do
  if aws sts get-caller-identity --region "${AWS_REGION}" >/dev/null 2>&1; then
    echo "IAM role is ready"
    break
  fi
  echo "Waiting for IAM credentials... ($i)"
  sleep 5
done

aws sts get-caller-identity --region "${AWS_REGION}" >/dev/null





# ===== DEFAULTS =====

VITE_API_BASE_URL=""
VITE_COGNITO_USER_POOL_ID=""
VITE_COGNITO_CLIENT_ID=""


# ===== BACKEND SECRET =====
if [[ -n "${CLIENT_SECRET_ID}" ]]; then
  SECRET_JSON="$(aws secretsmanager get-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${CLIENT_SECRET_ID}" \
    --query 'SecretString' \
    --output text)"

  echo "Secret JSON Backend: ${SECRET_JSON}"

  VITE_API_BASE_URL="$(echo "${SECRET_JSON}" | jq -r '.VITE_API_BASE_URL // ""')"
  VITE_COGNITO_USER_POOL_ID="$(echo "${SECRET_JSON}" | jq -r '.VITE_COGNITO_USER_POOL_ID // ""')"
  VITE_COGNITO_CLIENT_ID="$(echo "${SECRET_JSON}" | jq -r '.VITE_COGNITO_CLIENT_ID // ""')"
fi

# ===== WRITE ENV FILE =====
cat > /home/ec2-user/.env <<EOF
VITE_API_BASE_URL="${VITE_API_BASE_URL}"
VITE_COGNITO_USER_POOL_ID="${VITE_COGNITO_USER_POOL_ID}"
VITE_COGNITO_CLIENT_ID="${VITE_COGNITO_CLIENT_ID}"
EOF

chown ec2-user:ec2-user /home/ec2-user/.env
chmod 600 /home/ec2-user/.env

# ===== ECR LOGIN =====
for i in {1..10}; do
  if aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_REGISTRY}"; then
    echo "ECR login succeeded"
    break
  fi
  echo "ECR login retry $i"
  sleep 5
done

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# ===== RUN CONTAINER =====
docker rm -f backend || true
docker pull "${ECR_IMAGE}"

docker run -d \
  --name backend \
  --restart unless-stopped \
  --env-file /home/ec2-user/.env \
  -p 5173:5173 \
  "${ECR_IMAGE}"

echo "Bootstrap complete"