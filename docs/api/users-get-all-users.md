---
layout: default
parent: user resource
nav_order: 1
# tags used by AI files
title: Get all users
description: GET all `user` resources from the service
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

# Get all users

Returns an array of [`user`](user.md) objects that contains all users that have registered with the service.

## URL

```shell

{server_url}/users
```

## Parameters

None

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
    },
    {
        "last_name": "Jones",
        "first_name": "Jillio",
        "email": "jlo.jones@example.com",
        "id": 2
    }
    ...
]
```

## Return status

| Status value | Return status | Description |
| ------------- | ----------- | ----------- |
| 200 | Success | Requested data returned successfully |
|  ECONNREFUSED | N/A | Service is offline. Start the service and try again. |
