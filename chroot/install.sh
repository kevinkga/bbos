export DEBIAN_FRONTEND=noninteractive
mkswap /swapfile
swapon /swapfile
free -h

cd /root/chroot

df -h

apt -yq update
#apt -yq upgrade
apt install -yq ansible linux-modules-extra-raspi
apt -yq autoclean
apt -yq autoremove
apt -yq purge

# klipper config
rm -rf /home/klipper/klipper_config; cp -r ratos-configuration /home/klipper/klipper_config
chown -R klipper:klipper /home/klipper
chmod -R 600 /home/klipper/.ssh

SRC_DIR=$PWD
cd klipper-ubuntu
ansible-playbook --connection=local playbook.yml
cd ${SRC_DIR};


apt remove -yq ansible
df -h
apt -yq autoclean
apt -yq autoremove
apt -yq purge
swapoff /swapfile
