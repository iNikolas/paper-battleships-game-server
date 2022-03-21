const jwt = require("jsonwebtoken"),
    pool = require("../../db/postgreSql/settings"),
    handleGenerateAccessToken = require("./handleGenerateAccessToken");

const createTokens = async ({name, uid, rights}) => {

    const userSharedData = {
        name,
        uid,
        rights,
    };

    const accessToken = handleGenerateAccessToken(userSharedData);
    const refreshToken = jwt.sign(
        userSharedData,
        process.env.REFRESH_TOKEN_SECRET
    );

    await pool.query(
        `INSERT INTO refreshTokens (uid, token, user_uid) VALUES (uuid_generate_v4(), $1, $2)
                                                                  ON CONFLICT (user_uid) DO UPDATE SET token = EXCLUDED.token RETURNING *
                `,
        [refreshToken, uid]
    );

    return { accessToken, refreshToken };
};

module.exports = createTokens;