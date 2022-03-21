const {MAX_TOKEN_AGE_MIN} = require("../../common/constants");

const setAccessCookie = (res, accessToken) => {
    res.cookie("accessToken", accessToken, {
        maxAge: parseInt(MAX_TOKEN_AGE_MIN) * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
    });
}

module.exports = setAccessCookie