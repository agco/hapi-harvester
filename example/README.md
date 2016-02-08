# Example hapi-harvester server.

## Requirements

It is assumed that you have `node` v4 and `npm` installed on your system. You will also need `docker` to use `MongoDB`
for the backend of the server.

## MongoDB

It's assumed that you already have `docker-compose` installed on your system.
See [here](https://docs.docker.com/compose/install/) for information on installing it.

Once installed hapi-harvester comes with several scripts to install and validate
the dockerised MongoDB instance. These scripts are found in:

```shell
    $ cd node_modules/hapi-harvester/docker
```

The main script is `start.sh`

```shell
    $ cd ./start.sh
```

This will kick off several scripts to download, install and verify the
dockerised MongoDB instance with replicasets turned on.

If everything went to plan. You can now access your MongoDB with:

```shell
    $ docker-compose run msh
```

## Installation

Copy the contents of this directory to a location for testing. Then install the
dependencies:

```shell
    $ npm install
```

Once they're installed, simpily run the server:

```shell
    $ npm start
```

## Trying it out.

TODO: add the commands and expected output here.
