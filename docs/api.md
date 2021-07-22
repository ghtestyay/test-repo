# API documentation

**Note:** This documentation is incomplete in parts.

## About
All API endpoints are relative to the API root. Currently the API root is always just a domain with no path, but this can and will change in the future. Currently you need to set a `content-type: text/plain;charset=UTF-8` header with all requests due to a bug.

## Authentication
Generate a token from the Imports/Exports tab in Settings, then pass it to all requests in the `Authorization` header using the `Bearer` authentication type. It should look like:
```http
Authorization: Bearer ttwprivate_api!8.axaihDWNkJtPaFqQsOBqVnXu...
```
API tokens will always start with `ttwprivate_`.

## Concepts
### Pings
A ping is repersented as a JSON object:
| Key       | Value                                                     |
|-----------|-----------------------------------------------------------|
|time       | Time the ping was sent.                                   |
|tags       | Ping tags, joined by spaces.                              |
|interval   | What the average ping gap was when the ping was answered. |
|category   | Currently unused, ping category.                          |
|comment    | Currently unused, ping comment.                           |
|last_change| Timestamp of the last modification to the ping.           |

### Config
This is a simple key-value store. Keys starting with `retag` are reserved for internal use, you can use any other keys you want for any purpose.

## Endpoints

### GET `/`
This returns information about the currently authenticated user in a textual format for debugging.

### POST `/logout`
Invalidates the API token used to make the call.

### GET `/me.json`
A JSON object with data about the authenticated user.
| Key | Value   |
|-----|---------|
| uid | User ID |

### GET `/pings`
A JSON object. You can filter pings with query string params:

| Param | Explanation |
| ----- | ------------ |
| ?editedAfter=X | Only get pings modified or created after Unix time X |
| ?startTime=X | Pings with a timestamp after X |
| ?endTime=X | Pings with a timestamp before X |
| ?limit=X | Limit to X results, and sort pings from newest to oldest (to paginate, change startTime/endTime) |

This returns more than just pings to reduce the number of needed API calls. Response object:
| Key          | Value                                                  |
|--------------|--------------------------------------------------------|
| pings        | Array of pings                                         |
| config       | The config data for the user.                          |
| latestUpdate | Unix time (in seconds) since the last change to pings. |
| username     | Username of the logged in user.                        |

### PATCH `/pings`
The request body must be a JSON object, with a single key named `pings`. `pings` must be an array of ping objects. Each ping object in the database is overwritten (or created if it doesn't exist) with the update pings. Pings must not be from the future (`ping.time` can't be greater than the server time). Note that a request to this endpoint will result in Beeminder being updated if needed. If the `?merge=1`
URI parameter is specified, tags will be merged with existing ones, if any, by the server. Note one cannot delete existing tags with
this parameter specified, so if you are syncing to delete a tag this parameter should not be specified.

### GET `/config`
The user's config data, as a JSON object.

### PATCH `/config`
The request body should be a JSON object with a key of `changes`, and a value of a JSON object of keys and values to be changed in the user's config.

### GET `/db`
The per-user SQLite database for this user. Note that the database schema is subject to change, but it probably won't.

### DELETE `/db`
Deletes all data in the user's database. This is irreversible. Note that this only affects the user's pings/config, it doesn't delete the account, or affect authentication.

### GET `/pings/expected/:from/:to`
Returns all pings expected between the Unix time (in seconds) `from` and `to`.

### `/internal/*` endpoints
All API endpoints beginning with `/internal` are subject to change at any time. Only use them if also control the server on the other end (and ensure everything still works after an update), or are modifying the client/server itself. Although you aren't missing out on much, since these endpoints are mostly just for debugging/authentication/push.
