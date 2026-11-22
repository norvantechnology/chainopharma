# Chaino Pharma — low-cost single-server deploy

One small Ubuntu host runs:

- **Backend** Node (`local-server.js`) on port `4000` via PM2  
- **Frontend** static build served by Nginx on ports `80`/`443`  
- Nginx proxies `/api`, `/auth`, `/hello`, etc. to the backend so one public URL works for both

## Cost target

Prefer **Lightsail $5/mo (1 GB)** or **EC2 `t3.micro` / `t4g.micro`**.  
Do not create RDS/ALB/ECS — the app already uses Supabase Postgres.

## Required IAM for `provision.sh`

The `DEVELOPER` key currently **cannot** create servers (EC2 / Lightsail / S3 create denied).  
Attach policies that allow at least:

- `lightsail:*` **or** `ec2:*` + `ec2:RunInstances` related networking  
- `s3:PutObject` / `GetObject` on the app media bucket (optional, for uploads)

Then:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=ap-south-1   # cheapest common region for IN traffic

./deploy/aws/provision.sh
./deploy/aws/deploy.sh
```

## Redeploy (no deletes)

```bash
./deploy/aws/deploy.sh
```

Updates code + rebuilds frontend only. Does **not** delete the instance, volumes, DB, or uploaded files.
