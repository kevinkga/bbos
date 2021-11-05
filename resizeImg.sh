TARGET=$1
SIZE=$2
IMG_NAME=enlarged-${TARGET##*/}

cp ${TARGET} ${IMG_NAME}
dd if=/dev/zero bs=1M count=$SIZE >> ${IMG_NAME}

sudo growpart ${IMG_NAME} 2
