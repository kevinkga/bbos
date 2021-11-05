# Example:
# ./createImage.sh ~/Documents/ubuntu-21.10-preinstalled-server-armhf+raspi.img
SOURCE_IMG=$1
LOOP_DEVICE=$(sudo losetup -f)

echo Using loop device ${LOOP_DEVICE}
sudo losetup -P ${LOOP_DEVICE} ${SOURCE_IMG}

sudo e2fsck -fy ${LOOP_DEVICE}p2
sudo resize2fs ${LOOP_DEVICE}p2

sudo mkdir -p /mnt/ubuntu
sudo mount -o rw ${LOOP_DEVICE}p2 /mnt/ubuntu
#sudo cp -ar /mnt/ro/* /mnt/ubuntu/
sudo mount -o rw ${LOOP_DEVICE}p1 /mnt/ubuntu/boot

sudo mount --bind /dev /mnt/ubuntu/dev/
sudo mount --bind /sys /mnt/ubuntu/sys/
sudo mount --bind /proc /mnt/ubuntu/proc/
sudo mount --bind /dev/pts /mnt/ubuntu/dev/pts

sed -i 's/^/#CHROOT /g' /mnt/ubuntu/etc/ld.so.preload

sudo cp /usr/bin/qemu-arm-static /mnt/ubuntu/usr/bin/

sudo cp chroot/install.sh /mnt/ubuntu/root/install.sh
sudo chmod +x /mnt/ubuntu/root/install.sh

# chroot to raspbian
sudo chroot /mnt/ubuntu /root/install.sh

# ----------------------------
# Clean up
# revert ld.so.preload fix
sed -i 's/^#CHROOT //g' /mnt/ubuntu/etc/ld.so.preload

# unmount everything
sudo umount -l /mnt/ubuntu/{dev/pts,dev,sys,proc,boot,}

sudo losetup -d ${LOOP_DEVICE}
# qemu-system-arm -kernel system-boot/vmlinuz  -cpu arm1176 -m 256 -M versatilepb -dtb system-boot/bcm2835-rpi-zero-w.dtb -no-reboot -serial stdio -append 'root=/dev/sda2 panic=1 rootfstype=ext4 rw' -hda ~/Documents/ubuntu-21.10-preinstalled-server-armhf+raspi.img
sudo cp -ar overlay/system-boot/* /mnt/ubuntu/boot/
