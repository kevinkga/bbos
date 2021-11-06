# BBOS

Tools for building the Bumblebee 3D Printer OS for on Raspberry Pis.

# Installation

Run the `requirements.sh` script to install common dependencies for these scripts to work.

# Download a base image.

Disclaimer: This project has been tested with Ubuntu Server 22.x images so far. There are no guarantees that this will work with other images. 

Firstly to get started we will need a base image to build upon.

For example, fetch a base Ubuntu Server image from http://cdimage.ubuntu.com/ubuntu-server/daily-preinstalled/current or the official https://ubuntu.com/download/raspberry-pi and save the image in your Downloads folder (e.g `jammy-preinstalled-server-armhf+raspi.img.xz`).
This file will typically be stored compressed using xz, as hinted by the file extension. 
You will need to uncompress the image before being able to use it by using the following command:
```
cd ~/Downloads/
unxz jammy-preinstalled-server-armhf+raspi.img
```

# (optional) Resizing the base image

The typical server images of Ubuntu are small, around 3.5GB. Thus, if you intend to add a lot of data to this image it will need to be resized. 
This is where the `resizeImg.sh` tool comes in. 

For example, if you need 5GB more space for your customisations, you can issue the following command:

`./resizeImg.sh ~/Downloads/jammy-preinstalled-server-armhf+raspi.img 4000`

This tells the tool to *make a larger copy* of the image in the current path. The image in the current path will be named `enlarged-jammy-preinstalled-server-armhf+raspi.img` and will be 4000Mb larger than the original one.

# Customisations
There are two types of customisations that are implemented by this utility:
## Scripts
The entire `chroot` folder gets copied across to `/root/chroot` on the target system and `install.sh` gets called once the utility chroots into the system. 

Here you can modify what files you want to have made available and the entry point `install.sh` that will execute within the image building process. It is as simple as that.

For more complex deployments, I would recommend using more advanced tools like Ansible to provision the system. 

In fact, you can look at the default content of `install.sh` it clones a git repo of an Ansible Playbook and executes it locally.

## File overlay
These are files that you want to add or replace into the base image. These are stored in the `overlay` folder. Typically, your base image will have two main partitions:
- `system-boot`: This is where you will find the boot files e.g. the kernel and the initial ramdisk. It also contains the `firmware` folder which itself contains a few interesting files like:
    - `config.txt`: The Raspberry Pi configuration file
    - `network-config`: The Ubuntu Netplan config file
    - `user-data`: The Ubuntu cloud-init file
- `writable`: This is the root fs of the distribution and typically maps to `/` in the installation. You can also put in overrides for settings files etc in here. 
    - `bbos.txt`: This is a placeholder file

# Build the image
Building the image itself is simple. Just issue the following command: `./createImage.sh <your base image>`

e.g. `./createImage.sh enlarged-jammy-preinstalled-server-armhf+raspi.img`.

# Burn the image.
There are many tools that will write images to disk. However, a simple method is using DD:
`sudo dd bs=4M if=enlarged-jammy-preinstalled-server-armhf+raspi.img  of=/dev/sdX conv=fsync`

# Summary
In the, once you've understood the tools and the concepts around them, you can simplify the entire process of building images using the `deploy.sh` utility instead. This assumes that your customisations are in place and that you only want to build and deploy an image to a disk device.
```
sudo ./deploy.sh /dev/sdb
```