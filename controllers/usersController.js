const {ServerError} = require("./errorController"),
    pool = require('../db/postgreSql/settings'),
    bcrypt = require("bcrypt"),
    prepareAndSendRespond = require("./helpers/prepareAndSendUserResponse"),
    jwt = require("jsonwebtoken"),
    handleGenerateAccessToken = require("./helpers/handleGenerateAccessToken"),
    {HOST, MAX_TOKEN_AGE_MIN} = require("../common/constants"),
    setAccessCookie = require("./helpers/setAccessCookie");

module.exports = {
    createNewUser: async (req, res, next) => {
        try {
            const {type, attributes: user} = req.body.data;
            const name = user.name.trim();
            const password = user.password;

            if (type !== "users")
                throw new ServerError(
                    "Lacks valid authentication credentials for the requested resource!",
                    401,
                    "Unauthorized"
                );
            if (!name || !password)
                throw new ServerError(
                    "Username or password can't be empty!",
                    401,
                    "Unauthorized"
                );

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUserRequest = await pool.query(`INSERT INTO ${type} (uid, name, password, rights) VALUES(uuid_generate_v4(), $1, $2, 'user') RETURNING *`, [
                name,
                hashedPassword,
            ]);

            const newUser = newUserRequest.rows[0];

            await prepareAndSendRespond(newUser, res)
        } catch (error) {
            next(error);
        }
    },
    loginUser: async (req, res, next) => {
        try {
            const {type, attributes: {name, password}} = req.body.data;

            if (type !== "users")
                throw new ServerError(
                    "Lacks valid authentication credentials for the requested resource!",
                    401,
                    "Unauthorized"
                );

            const userRequest = await pool.query(
                `SELECT * FROM users WHERE name = $1`,
                [name]
            );
            const user = userRequest.rows[0];

            if (!user) next();

            if (await bcrypt.compare(password, user.password)) {
                await prepareAndSendRespond(user, res)
            } else {
                throw new ServerError(
                    "Lacks valid authentication credentials for the requested resource!",
                    401,
                    "Unauthorized"
                );
            }
        } catch (error) {
            next(error);
        }
    },
    refreshAccessToken: async (req, res, next) => {
        try {
            const refreshToken = req.cookies.refreshToken;

            if (!refreshToken)
                throw new ServerError(
                    "Lacks valid authentication credentials for the requested resource!",
                    401,
                    "Unauthorized"
                );

            const refreshTokenRequest = await pool.query(
                `SELECT * FROM refreshtokens, users WHERE refreshtokens.token = $1 AND users.uid = refreshtokens.user_uid`,
                [refreshToken]
            );
            const refreshTokenRespond = refreshTokenRequest.rows[0];

            if (!refreshTokenRespond)
                throw new ServerError(
                    "Authentication credentials for the requested resource are not valid!",
                    403,
                    "Forbidden"
                );
            jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET,
                (err, user) => {
                    if (err)
                        throw new ServerError(
                            "Authentication credentials for the requested resource are not valid!",
                            403,
                            "Forbidden"
                        );

                    const {name, uid: id, rights} = refreshTokenRespond

                    const userSharedData = {
                        name,
                        uid: id,
                        rights,
                    };

                    const accessToken = handleGenerateAccessToken(userSharedData);
                    const expiresInSec = parseInt(MAX_TOKEN_AGE_MIN) * 60;

                    const resData = {
                        links: {
                            self: `${HOST}/${user.uid}`,
                        },
                        data: {
                            type: "users",
                            id,
                            attributes: {
                                name,
                                rights,
                            },
                            token: accessToken,
                        },
                        meta: {expiresInSec},
                    };

                    setAccessCookie(res, accessToken)

                    res.set({
                        "Content-Type": "application/vnd.api+json",
                        Location: `${HOST}/users/${user.uid}`,
                    });
                    res.status(201);

                    res.json(resData);
                }
            );
        } catch (error) {
            next(error);
        }
    },
    logoutUser: async (req, res, next) => {
        try {
            const refreshToken = req.cookies.refreshToken;

            const deleteRefreshTokenRequest = await pool.query(
                `DELETE FROM refreshtokens WHERE token = $1`,
                [refreshToken]
            );

            res.cookie("refreshToken", null, {
                maxAge: 0,
                httpOnly: true,
                sameSite: "none",
                secure: true,
            });

            const isDeleted = !!deleteRefreshTokenRequest.rowCount;

            if (isDeleted) {
                res.status(204);
                res.send();
            } else {
                next();
            }
        } catch (err) {
            next(err);
        }
    },
    updateUser: async (req, res, next) => {
        try {
            const id = req.params.id;
            const {newName, oldPassword, newPassword} = req.body.data.attributes;

            if (!newName && !newPassword)
                throw new ServerError(
                    "Lack of data to process. Please provide at least newName or newPassword, not empty fields!",
                    400,
                    "Bad Request"
                );

            const userRequest = await pool.query(
                `SELECT * FROM users WHERE uid = $1`,
                [id]
            );
            const userRespond = userRequest.rows[0];

            if (!userRespond) next();

            if (await bcrypt.compare(oldPassword, userRespond.password)) {
                const name = newName || userRespond.name;
                const password = newPassword
                    ? await bcrypt.hash(newPassword, 10)
                    : userRespond.password;

                await pool.query(
                    `UPDATE users SET name = $1, password = $2 WHERE uid = $3`,
                    [name, password, id]
                );

                res.status(204);
                res.send();
            } else {
                throw new ServerError(
                    "You have typed in wrong old password!",
                    403,
                    "Forbidden"
                );
            }
        } catch (error) {
            next(error);
        }
    },
}