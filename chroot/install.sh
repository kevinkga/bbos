export DEBIAN_FRONTEND=noninteractive
SRC_DIR=$PWD
mkswap /swapfile
swapon /swapfile
free -h

cd /root/chroot
df -h

apt -yq update
apt -yq upgrade
apt install -yq ansible linux-modules-extra-raspi
apt -yq autoclean
apt -yq autoremove
apt -yq purge

cd klipper-ubuntu
ansible-playbook --connection=local playbook.yml

cd ${SRC_DIR}; rm -rf /home/klipper/klipper_config; mv ratos-configuration /home/klipper/klipper_config
cd ${SRC_DIR};
mkdir -p /home/klipper/.ssh;
cat id_rsa > /home/klipper/.ssh/id_rsa
cat authorized_keys > /home/klipper/.ssh/authorized_keys
chown -R klipper:klipper /home/klipper/.ssh
chmod -R 600 /home/klipper/.ssh

apt remove -yq ansible
df -h
apt -yq autoclean
apt -yq autoremove
apt -yq purge
