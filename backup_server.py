# -*- coding: utf-8 -*-
import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('153.75.224.178', username='root', password='***REMOVED***', timeout=15)

def run(cmd, timeout=60):
    print("$ " + cmd[:80])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8','replace') + e.read().decode('utf-8','replace')
    if out.strip(): print(out.strip()[:300])
    return out

from datetime import datetime
ts = datetime.now().strftime("%Y-%m-%d_%H-%M")
bk = f"/root/backups/inc-backup-{ts}"

print(f"\n=== BACKUP INC NETWORK — {ts} ===\n")

run(f"mkdir -p {bk}")

# Frontend
run(f"cp -r /var/www/incnetwork/frontend {bk}/frontend")
print("✓ Frontend")

# API faucet
run(f"cp -r /var/www/incnetwork/api {bk}/api")
print("✓ API Faucet")

# Bot upkeep
run(f"cp -r /var/www/incnetwork/bot {bk}/bot")
print("✓ Bot Upkeep")

# Nginx config
run(f"cp /etc/nginx/sites-available/incnetwork {bk}/nginx-incnetwork.conf")
print("✓ Nginx config")

# PM2 ecosystem files
run(f"cp /var/www/incnetwork/api/ecosystem.config.js {bk}/ecosystem-api.js 2>/dev/null; cp /var/www/incnetwork/bot/ecosystem.config.js {bk}/ecosystem-bot.js 2>/dev/null")
print("✓ PM2 ecosystems")

# Status no momento do backup
run(f"pm2 list 2>&1 | cat > {bk}/pm2-status.txt")
run(f"nginx -t 2>&1 >> {bk}/pm2-status.txt")
run(f"df -h >> {bk}/pm2-status.txt && free -m >> {bk}/pm2-status.txt")
print("✓ Status (PM2 + nginx + disco + memória)")

# Compacta tudo
run(f"tar -czf {bk}.tar.gz -C /root/backups inc-backup-{ts} && rm -rf {bk}", timeout=120)
print(f"✓ Compactado: {bk}.tar.gz")

# Lista backups existentes
print("\n=== BACKUPS NO SERVIDOR ===")
run("ls -lh /root/backups/")

# Remove backups com mais de 7 dias
run("find /root/backups/ -name '*.tar.gz' -mtime +7 -delete && echo 'Antigos removidos'")

print("\n=== STATUS FINAL ===")
run("pm2 list 2>&1 | cat")

client.close()
print(f"\n✅ Backup concluído: {bk}.tar.gz")
