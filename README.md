# Acurast Websocket Service

## Run

```bash
yarn start
```

or

```bash
yarn start:prod
```

## Configuration

See config file [acurast.proxy.config.json](./src/acurast.proxy.config.json) for P2P configs.

The `peerId` settings in the config are set to development values that should be replaced for real deployments.

## Websocket port

The websocket port is set to `9001` in [server.ts](./src/server.ts).

## Docker build

```bash
docker build .
```