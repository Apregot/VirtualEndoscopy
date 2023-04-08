#!/bin/bash
for ((port = 8000; port < 8999; port++))
  do
    nc -z localhost port
    if [ $? -ne 0 ]
    then
      exit $port
    fi
  done
exit -1