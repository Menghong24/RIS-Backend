exports.authorize = (roles = []) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: No user found'});
        }
        if (!roles.includes(user.role)) {
            return res.status(403).json({message: 'Forbidden: You do not have permission'})
        }
        next()
    }
}