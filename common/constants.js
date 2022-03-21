const isProduction = process.env.NODE_ENV === "production";

const HOST = isProduction
    ? "https://paper-battleships.herokuapp.com/"
    : "http://localhost:4000";

const MAX_TOKEN_AGE_MIN = '5m'

module.exports = { HOST, MAX_TOKEN_AGE_MIN };
