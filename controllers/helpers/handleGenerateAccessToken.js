const jwt = require("jsonwebtoken"),
    {MAX_TOKEN_AGE_MIN} = require("../../common/constants");

const handleGenerateAccessToken = (user) => {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: MAX_TOKEN_AGE_MIN });
};

module.exports = handleGenerateAccessToken;
