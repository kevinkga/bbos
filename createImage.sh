# Example:
# ./createImage.sh ~/Documents/ubuntu-21.10-preinstalled-server-armhf+raspi.img
SOURCE_IMG=$1
LOOP_DEVICE=$(losetup -f)
SWAPFILE=/storage/swapfile
TARGET_CHROOT_DIR=/mnt/ubuntu
#set -e

echo Using loop device ${LOOP_DEVICE}
losetup -P ${LOOP_DEVICE} ${SOURCE_IMG}

e2fsck -fy ${LOOP_DEVICE}p2
resize2fs ${LOOP_DEVICE}p2
fsck.ext4 -vfy ${LOOP_DEVICE}p2

# create a big swap file to be used inside the chroot
echo Creating swap file ${SWAPFILE}...
dd if=/dev/zero of=${SWAPFILE} bs=1M count=8192 status=progress
chmod 600 ${SWAPFILE}

mkdir -p ${TARGET_CHROOT_DIR}
mount -o rw ${LOOP_DEVICE}p2 ${TARGET_CHROOT_DIR}
#cp -ar /mnt/ro/* ${TARGET_CHROOT_DIR}/
mkdir -p ${TARGET_CHROOT_DIR}/system-boot; mount -o rw ${LOOP_DEVICE}p1 ${TARGET_CHROOT_DIR}/system-boot

mount --bind /dev ${TARGET_CHROOT_DIR}/dev/
mount --bind /sys ${TARGET_CHROOT_DIR}/sys/
mount --bind /proc ${TARGET_CHROOT_DIR}/proc/
mount --bind /dev/pts ${TARGET_CHROOT_DIR}/dev/pts
mount --bind /run ${TARGET_CHROOT_DIR}/run
touch ${TARGET_CHROOT_DIR}/swapfile; mount --bind ${SWAPFILE} ${TARGET_CHROOT_DIR}/swapfile

#sed -i 's/^/#CHROOT /g' ${TARGET_CHROOT_DIR}/etc/ld.so.preload

cp /usr/bin/qemu-arm-static ${TARGET_CHROOT_DIR}/usr/bin/

cp -arv chroot ${TARGET_CHROOT_DIR}/root/
chmod +x ${TARGET_CHROOT_DIR}/root/chroot/install.sh

# apply overlay
cp -rv overlay/system-boot/* ${TARGET_CHROOT_DIR}/system-boot/
cp -rv overlay/writable/* ${TARGET_CHROOT_DIR}/

# chroot to ubuntu
chroot ${TARGET_CHROOT_DIR} /root/chroot/install.sh
#chroot ${TARGET_CHROOT_DIR} /bin/bash

# ----------------------------
# Clean up
rm ${TARGET_CHROOT_DIR}/usr/bin/qemu-arm-static
rm -rf /root/chroot

# unmount everything
umount -l ${TARGET_CHROOT_DIR}/{dev/pts,dev,sys,proc,system-boot,}
umount -l ${SWAPFILE}

rm -rf ${TARGET_CHROOT_DIR}/system-boot
losetup -d ${LOOP_DEVICE}
