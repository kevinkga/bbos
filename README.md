# BBOS

Tools for building the Bumblebee OS for 3D Printers on Raspberry Pis.

# Installation

Run the requirement.sh script to install common dependencies for these scripts to work.

# Download a base image.

This project has been tested with Ubuntu Server images so far. There are no guarantees that this will work with other images. 
Firstly to get started we will need a base image to build upon.

For example, fetch a base Ubuntu Server image from here https://ubuntu.com/download/raspberry-pi and save the image in your Downloads folder (e.g `ubuntu-21.10-preinstalled-server-armhf+raspi.img.xz`).
This file will typically be stored compressed using xz, as hinted by the file extension. 
You will need to uncompress the image before being able to use it by using the following command:
```
cd ~/Downloads/
unxz ubuntu-21.10-preinstalled-server-armhf+raspi.img
```

`sudo dd bs=4M if=enlarged-ubuntu-21.10-preinstalled-server-armhf+raspi.img  of=/dev/sdb conv=fsync`

# (optional) Resizing the base image

The typical server images of Ubuntu are small, around 3.5GB. Thus, if you intend to add a lot of data to this image it will need to be resized. 
This is where the `resizeImg.sh` tool comes in. 

For example, if you need 5GB more space for your customizations, you can issue the following command:

`./resizeImg.sh ~/Downloads/ubuntu-21.10-preinstalled-server-armhf+raspi.img 4000`

This tells the tool to *make a larger copy* of the image in the current path. The image in the current path will be named `enlarged-ubuntu-21.10-preinstalled-server-armhf+raspi.img` and will be 4000Mb larger than the original one.

# Customisations
There are two types of customisations that are implemented by this utility:
## File overlay
These are files that you want to add or replace into the base image. These are stored in the `overlay` folder. Typically, your base image will have two main partitions:
- `system-boot`: This is where you will find the boot files e.g. the kernel and the initial ramdisk. It also contains the `firmware` folder which itself contains a few interesting files like:
    - `config.txt`: The Raspberry Pi configuration file
    - `network-config`: The Ubuntu Netplan config file
    - `user-data`: The Ubuntu cloud-init file
- `writable`: This is the root fs of the distribution and typically maps to `/` in the installation. You can also put in overrides for settings files etc in here. 
    - `bbos.txt`: This is a placeholder file
## Scripts
Under the `chroot` folder you will find an `install.sh` script that you can modify and that will execute within the image building process. It is as simple as that. 

For more complex deployments, I would recommend using more advanced tools like Ansible to provision the system. In fact, you can look at the default content of `install.sh` where it clones a git repo of an Ansible Playbook and executes it locally. 

# Build the image
Building the image itself is simple. Just issue the following command: `./createImage.sh <your base image>`

e.g. `./createImage.sh enlarged-ubuntu-21.10-preinstalled-server-armhf+raspi.img`.

# Burn the image.
There are many tools that will write images to disk. However, a simple method is using DD:
`sudo dd bs=4M if=enlarged-ubuntu-21.10-preinstalled-server-armhf+raspi.img  of=/dev/sdX conv=fsync`

