#!/bin/bash

echo "installing curl..."
apt-get update
apt-get install -y curl

MONGODB1=`ping -c 1 mongo1 | head -1  | cut -d "(" -f 2 | cut -d ")" -f 1`

/scripts/wait-until-started.sh


echo "================================="
echo "Writing to MongoDB"
mongo ${MONGODB1} <<EOF
  use test
  rs.config()
  var p = {title: "Breaking news", content: "It's not summer yet."}
  db.entries.save(p)
EOF


echo "================================="
echo "Fetching data from Mongo"
echo curl http://${MONGODB1}:28017/test/entries/?limit=10
curl http://${MONGODB1}:28017/test/entries/?limit=10
echo "================================="


echo "================================="
echo "DONE"
