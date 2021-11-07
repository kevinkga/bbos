# Example:
# ./createImage.sh ~/Documents/ubuntu-21.10-preinstalled-server-armhf+raspi.img
SOURCE_IMG=$1
LOOP_DEVICE=$(losetup -f)

#set -e

echo Using loop device ${LOOP_DEVICE}
losetup -P ${LOOP_DEVICE} ${SOURCE_IMG}

e2fsck -fy ${LOOP_DEVICE}p2
resize2fs ${LOOP_DEVICE}p2
fsck.ext4 -vfy ${LOOP_DEVICE}p2

# create a big swap file to be used inside the chroot
fallocate -l 8G cache//swapfile
chmod 600 cache/swapfile

mkdir -p /mnt/ubuntu
mount -o rw ${LOOP_DEVICE}p2 /mnt/ubuntu
#cp -ar /mnt/ro/* /mnt/ubuntu/
mount -o rw ${LOOP_DEVICE}p1 /mnt/ubuntu/boot

mount --bind /dev /mnt/ubuntu/dev/
mount --bind /sys /mnt/ubuntu/sys/
mount --bind /proc /mnt/ubuntu/proc/
mount --bind /dev/pts /mnt/ubuntu/dev/pts
mount --bind /run /mnt/ubuntu/run
ln -s ${PWD}/cache/swapfile /mnt/ubuntu/swapfile
#sed -i 's/^/#CHROOT /g' /mnt/ubuntu/etc/ld.so.preload

cp /usr/bin/qemu-arm-static /mnt/ubuntu/usr/bin/

cp -arv chroot /mnt/ubuntu/root/
chmod +x /mnt/ubuntu/root/chroot/install.sh
rm /mnt/ubuntu/swapfile

# apply overlay
cp -rv overlay/system-boot/* /mnt/ubuntu/boot/
cp -rv overlay/writable/* /mnt/ubuntu/

# chroot to ubuntu
chroot /mnt/ubuntu /root/chroot/install.sh
#chroot /mnt/ubuntu /bin/bash

# ----------------------------
# Clean up
rm /mnt/ubuntu/usr/bin/qemu-arm-static
rm -rf /root/chroot

# unmount everything
umount -l /mnt/ubuntu/{dev/pts,dev,sys,proc,boot,}

losetup -d ${LOOP_DEVICE}
# qemu-system-arm -kernel system-boot/vmlinuz  -cpu arm1176 -m 256 -M versatilepb -dtb system-boot/bcm2835-rpi-zero-w.dtb -no-reboot -serial stdio -append 'root=/dev/sda2 panic=1 rootfstype=ext4 rw' -hda ~/Documents/ubuntu-21.10-preinstalled-server-armhf+raspi.img
