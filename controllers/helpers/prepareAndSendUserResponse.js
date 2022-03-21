const createTokens = require("./createTokens"),
    {HOST} = require("../../common/constants"),
    setAccessCookie = require("./setAccessCookie");

const prepareAndSendRespond = async (user, res) => {
    const {uid: id, rights, name} = user
    const {accessToken, refreshToken} = await createTokens(user);

    const resData = {
        data: {
            type: "users",
            id,
            attributes: {
                name,
                rights,
            },
            links: {
                self: `${HOST}/users/${id}`,
            },
            token: accessToken,
        },
    };

    const maxAgeDays = 7;


    res.cookie("refreshToken", refreshToken, {
        maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
    });

    setAccessCookie(res, accessToken)

    res.set({
        "Content-Type": "application/vnd.api+json",
        Location: `${HOST}/users/${id}`,
    });
    res.status(201);

    res.json(resData);
}

module.exports = prepareAndSendRespond