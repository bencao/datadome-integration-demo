# Datadome Integration Demo

## Prerequisite

1. create a .env.local file, with the following environment variables:

```
DATADOME_SERVER_KEY=...
```

2. `yarn dev`

3. Visit 

```
# example for protected server side rendering
http://localhost:3000/

# example for protected vercel function
http://localhost:3000/api/hello
```

## Server Side Integration

- lib/datadome.js
- middleware.js (handles serverside rendering)
- pages/api/hello.js (handles extra vercel functions)

## Client Side Integration

- pages/_document.js
