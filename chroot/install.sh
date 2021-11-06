export DEBIAN_FRONTEND=noninteractive
cd /root/chroot
df -h
dhclient
apt -yq update && apt install -yq ansible

cd klipper-ubuntu
ansible-playbook --connection=local playbook.yml

df -h
apt -yq autoclean
apt -yq autoremove
apt -yq purge
