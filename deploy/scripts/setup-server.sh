#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 server (Oracle Cloud Ampere A1 or any VM) for Kirana.
# Run as the default user (ubuntu) with sudo rights:   bash deploy/scripts/setup-server.sh
set -euo pipefail

echo "==> Updating packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg git unattended-upgrades iptables-persistent

echo "==> Installing Docker Engine + Compose plugin (official apt repository)"
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "==> Opening ports 80 and 443 in the OS firewall"
# Oracle's Ubuntu images ship iptables rules that REJECT everything except SSH; the cloud
# security list must ALSO allow 80/443 (see docs/DEPLOYMENT.md).
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
fi
sudo netfilter-persistent save

echo "==> Swap file (helps the build on small machines)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

echo "==> Automatic security updates"
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Done. Log out and back in (so the docker group applies), then continue with docs/DEPLOYMENT.md."
