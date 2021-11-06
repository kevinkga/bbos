TARGET=$1
SIZE=$2
IMG_NAME=$3

cp ${TARGET} ${IMG_NAME}
echo Expanding ${IMG_NAME} by ${SIZE}M...
dd if=/dev/zero bs=1M count=$SIZE status=progress >> ${IMG_NAME}

growpart ${IMG_NAME} 2
