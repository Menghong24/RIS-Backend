const jwt = require("jsonwebtoken")
exports.protect = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]
    if(!token){
        return res.status(401).send({
            err: "Unauthoriztion!"
        })
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if(!payload) {
        return res.status(401).send({ err: "Invalid token"})
    }
    req.user = payload
    next()
}
