export DEBIAN_FRONTEND=noninteractive

mkswap /swapfile
swapon /swapfile
free -h

cd /root/chroot
df -h

apt -yq update && apt install -yq ansible linux-modules-extra-raspi
apt -yq upgrade
apt -yq autoclean
apt -yq autoremove
apt -yq purge

cd klipper-ubuntu
ansible-playbook --connection=local playbook.yml

apt remove -yq ansible
df -h
apt -yq autoclean
apt -yq autoremove
apt -yq purge
