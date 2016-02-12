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

## Trying it all out.

In a browser, open:

```
  http://localhost:3000/brands
```

And we should get a response from the server like this:

```
  {"data":[]}
```

Not very exciting as we don't have any data yet. So lets do that now. Again using `curl` in a terminal, we can add data.

```shell
  $ curl -X "POST" "http://localhost:3000/brands" \
    -H "Content-Type: application/json" \
    -d $'{ "data": { "type": "brands", "attributes": { "code": "MF", "description": "Massey Ferguson" } } }'
```

Now when we refresh the browser, we get:

```
  {"data":[{"type":"brands","attributes":{"code":"MF","description":"Massey Ferguson"},"id":"8ab18ce6-0811-4a92-a686-c4124921eda1"}]}
```

But that's not all, say we switched brands and need to update our backend. Using `curl`, we can edit our data.

```
  $ curl -X "PATCH" "http://localhost:3000/brands/8ab18ce6-0811-4a92-a686-c4124921eda1" \
    -H "Content-Type: application/json" \
    -d $'{ "data": { "type": "brands", "attributes": { "code": "VT", "description": "Viltra" } } }'
```

Now if we refresh the browser again, we get:

```
  {"data":[{"type":"brands","attributes":{"description":"Viltra","code":"VT"},"id":"8ab18ce6-0811-4a92-a686-c4124921eda1"}]}
```

Finally we can delete this record too. Again using `curl`, we can issue the following command:

```
  $ curl -X "DELETE" "http://localhost:3000/brands/8ab18ce6-0811-4a92-a686-c4124921eda1" \
    -H "Content-Type: application/json"
```

And after refreshing the browser, we're back to were we started, with no records in the database.

```
  {"data":[]}
```

