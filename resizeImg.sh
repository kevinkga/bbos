TARGET=$1
SIZE=$2
IMG_NAME=$3

cp ${TARGET} ${IMG_NAME}
dd if=/dev/zero bs=1M count=$SIZE >> ${IMG_NAME}

growpart ${IMG_NAME} 2
