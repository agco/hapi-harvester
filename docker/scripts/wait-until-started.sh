#!/bin/bash

MONGODB1=`ping -c 1 mongo1 | head -1  | cut -d "(" -f 2 | cut -d ")" -f 1`

echo "Waiting for the mongos to complete the election."
until curl http://${MONGODB1}:28017/isMaster\?text\=1  2>&1 | grep ismaster | grep true; do
  printf '.'
  sleep 1
done
echo "The primary is elected."
