#!/bin/sh
docker-compose up -d mongo1 && docker-compose run mongosetup && docker-compose run verify