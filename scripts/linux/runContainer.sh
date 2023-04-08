#!/bin/bash
dockerExecutable=$1
port=$2
imageName=$2

$dockerExecutable run -d -p ${port}:8889 $imageName