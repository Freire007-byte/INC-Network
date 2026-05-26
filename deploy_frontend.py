# -*- coding: utf-8 -*-
import paramiko, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('153.75.224.178', username='root', password='***REMOVED***', timeout=15)

sftp = client.open_sftp()

BASE_LOCAL  = r"C:\Users\Loja\Downloads\INC-SmartContract\INC-contract\frontend"
BASE_REMOTE = "/var/www/incnetwork/frontend"

for fname in ["index.html", "sw.js"]:
    local  = os.path.join(BASE_LOCAL, fname)
    remote = f"{BASE_REMOTE}/{fname}"
    with open(local, "r", encoding="utf-8") as f:
        content = f.read()
    with sftp.open(remote, "w") as f:
        f.write(content)
    print(f"Enviado: {fname}")

sftp.close()
client.close()
print("Deploy concluido!")
