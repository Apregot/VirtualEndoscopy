#!/bin/bash
echo "making atb executable"
PEANAME=pea/atb:latest
docker run -it --rm -v `pwd`/ArterialTreeBuilder:/APP cradle/u:3 /bin/bash -c 'mkdir -p /APP/build && cd /APP/build && cmake .. && make'
if [ $? -ne 0 ] 
then 
	exit 1 
fi

	echo "Building container \"pea/atb:latest\" "
	BUILDDIR=/tmp/pea-atb
	rm -rf $BUILDDIR; mkdir -p $BUILDDIR
	cp ArterialTreeBuilder/build/atb $BUILDDIR
	echo -e 'FROM scratch\nADD atb /\nCMD ["/atb"]' > $BUILDDIR/Dockerfile
	docker build --tag $PEANAME $BUILDDIR
