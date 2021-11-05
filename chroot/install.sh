export DEBIAN_FRONTEND=noninteractive
cd /root
df -h
dhclient
apt -yq update && apt install -yq ansible

git clone https://github.com/kevinkga/klipper-ubuntu.git
cd klipper-ubuntu
ansible-playbook --connection=local playbook.yml

df -h
apt -yq autoclean
apt -yq autoremove
apt -yq purge
