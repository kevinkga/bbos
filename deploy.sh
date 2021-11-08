source ./config.sh $1
rm ${ENLARGED_IMAGE}
if test -f "$BASE_IMAGE"; then
  echo "Using ${BASE_IMAGE} as base image"
else
  echo "${BASE_IMAGE} not found. Downloading it from ${REMOTE_IMAGE_TARGET} into ${CACHED_ORIGINAL_IMAGES}"
  cd ${CACHED_ORIGINAL_IMAGES}
  wget ${REMOTE_IMAGE_TARGET}
  unxz ${IMAGE_COMPRESSED_NAME}
  cd ${ORIGINAL_BASE_PATH}
fi

./resizeImg.sh ${BASE_IMAGE} 4000 ${ENLARGED_IMAGE}
./createImage.sh ${ENLARGED_IMAGE}

#burn image
umount ${BOOT_PART_DEVICE};
umount ${ROOT_PART_DEVICE};
echo Writing the image ${ENLARGED_IMAGE} to ${TARGET_DEVICE}...
dd bs=4M if=${ENLARGED_IMAGE} of=${TARGET_DEVICE} conv=fsync status=progress

#check burnt image
partprobe
umount ${ROOT_PART_DEVICE}; fsck.ext4 -vfy ${ROOT_PART_DEVICE}
umount ${BOOT_PART_DEVICE}; dosfsck -w -r -l -a -v -t ${BOOT_PART_DEVICE}