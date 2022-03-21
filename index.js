const express = require("express"),
    http = require('http'),
    app = express(),
    router = express.Router(),
    WebSocket = require('ws'),
    server = http.createServer(app),
    cors = require('cors'),
    cookieParser = require('cookie-parser'),
    bodyParser = require("body-parser"),
    {mediaTypeError, internalServerError, pageNotFoundError} = require("./controllers/errorController"),
    {createNewUser, loginUser, logoutUser, refreshAccessToken, updateUser} = require('./controllers/usersController'),
    handleAuthenticateToken = require("./controllers/helpers/authFunctions/handleAuthenticateToken"),
    {checkRequestValidity} = require("./controllers/helpers/authFunctions/permissions/user"),
    parseCookie = require("./controllers/helpers/websocket/parseCookie"),
    jwt = require("jsonwebtoken"),
    refuseSocketConnection = require("./controllers/helpers/authFunctions/refuseSocketConnection"),
    broadcastMessage = require("./controllers/helpers/websocket/broadcastMessage"),
    {refreshRedisSet, updateRedisSet, updateRedisList, getRedisSet, getRedisList} = require("./db/redis/redis"),
    parseMessage = require("./controllers/helpers/websocket/parseMassage"),
    isProduction = process.env.NODE_ENV === "production";

app.use('/', router)

router.use(cors({
    origin: isProduction
        ? "https://inikolas.github.io"
        : "http://localhost:3000",
    credentials: true,
}))
    .use(cookieParser())
    .use(bodyParser.json({type: "application/vnd.api+json"}))
    .use(mediaTypeError)

router.post("/users", createNewUser);

router.post("/users/login", loginUser);
router.post("/users/token", refreshAccessToken);

router.delete("/users/logout", logoutUser)

router.patch("/users/:id", handleAuthenticateToken, checkRequestValidity, updateUser)

router.use(internalServerError);
router.use(pageNotFoundError);

const webSocketServer = new WebSocket.Server({server})

webSocketServer.on('connection', async (ws) => {

    ws.isAlive = true

    const online = await getRedisSet('online')
    const messages = await getRedisList('messages')
    ws.send(JSON.stringify({online, messages}))

    ws.on('pong', () => ws.isAlive = true)

    ws.on('message', (message) => {
        const {errors, token, chatMessage} = parseMessage(message)
        if (errors) return ws.send(JSON.stringify({errors}))
        jwt.verify(token || '', process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
            if (err) return ws.send(JSON.stringify({errors: [err.message]}))

            const name = user.name

            if (chatMessage) {
                await updateRedisList('messages', {name, message: chatMessage, date: Date.now()})
                const messages = await getRedisList('messages')
                broadcastMessage(webSocketServer, {messages})
            }
        });
    })
})

server.on('upgrade', (req, socket, head) => {
    const {accessToken: token} = parseCookie(req.headers.cookie)

    if (!token) return refuseSocketConnection(socket)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return refuseSocketConnection(socket)
        socket.user = user
        updateRedisSet('online', user.name)
    })
})

setInterval(() => {
    const onlineSet = new Set()

    webSocketServer.clients.forEach((ws) => {

        if (!ws.isAlive) return ws.terminate()

        onlineSet.add(ws._socket.user.name);

        ws.isAlive = false
        ws.ping()
    })

    const online = [...onlineSet]

    refreshRedisSet('online', online)
    broadcastMessage(webSocketServer, {online})
}, 30000)

server.listen(+process.env.PORT || 4000, () => {
    console.log(`Server started on port ${server.address().port}.`)
})