---
layout: default
parent: user resource
nav_order: 2
# tags used by AI files
title: Get a user by ID
description: GET the `user` resource with the specified ID from the service
tags: [api]
categories: [api-reference]
ai_relevance: high
importance: 7
prerequisites: [/api/user]
related_pages: []
examples: []
api_endpoints: [GET /users]
version: "v1.0"
last_updated: "2025-05-08"
---

# Get user by ID

Returns an array of  [`user`](user.md) objects that contains only the user specified by the `id` parameter, if it exists.

## URL

```shell

{server_url}/users/{id}
```

## Parameters

| Parameter name | Type | Description |
| -------------- | ------ | ------------ |
| `id` | number | The record ID of the user to return |

## Request headers

None

## Request body

None

## Return body

```js
[
    {
        "last_name": "Smith",
        "first_name": "Ferdinand",
        "email": "f.smith@example.com",
        "id": 1
    }
]
```

## Return status

| Status value | Return status | Description |
| ------------- | ----------- | ----------- |
| 200 | Success | Requested data returned successfully |
| 404 | Error | Specified user record not found |
|  ECONNREFUSED | N/A | Service is offline. Start the service and try again. |
