export DEBIAN_FRONTEND=noninteractive
cd /root/chroot
df -h

apt -yq update && apt install -yq ansible
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
