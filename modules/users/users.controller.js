const bcryptjs = require('bcryptjs');
const { UserModel } = require('./users.model');
const jwt = require('jsonwebtoken');

exports.createUser = async (req, res) => {
    try {
        if (!req.body?.username || !req.body?.password) {
            return res.status(400).send({ err: "Username and password are required" });
        }

        const existingUser = await UserModel.findOne({ username: req.body.username });
        if (existingUser) {
            return res.status(409).send({ err: "Username already exists" });
        }

        const hashedPassword = await bcryptjs.hash(req.body.password, 10);
        const newUser = await UserModel.create({ ...req.body, password: hashedPassword });

        newUser.password = undefined;

        res.status(201).send({
            msg: "created",
            result: newUser
        });

    } catch (error) {
        console.error("Error in createUser:", error);
        res.status(500).send({ err: "Internal server error" });
    }
};

exports.loginUser = async (req, res) => {
    try {
        if (!req.body?.username || !req.body?.password) {
            return res.status(400).send({ err: "Username and password are required" });
        }

        const user = await UserModel.findOne({ username: req.body.username }).select('+password');
        
        if (!user) {
            return res.status(401).send({ err: "Invalid credentials" });
        }

        const isMatch = await bcryptjs.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(401).send({ err: "Invalid credentials" });
        }

        const token = jwt.sign(
            { _id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(200).send({
            msg: "login successfully!",
            token: token,
        });

    } catch (error) {
        console.error("Error in loginUser:", error);
        res.status(500).send({ err: "Internal server error" });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await UserModel.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).send({ err: "User not found!" });
        }
        res.status(200).send({
            msg: "Get profile",
            result: user
        });
    } catch (error) {
        console.error("Error in getProfile:", error);
        res.status(500).send({ err: "Internal server error" });
    }
};

exports.logOut = async (req, res) => {
    // With JWT, logout is usually handled client-side by destroying the token,
    // but returning a success response here is standard practice.
    res.status(200).send({
        msg: "Logout successfully!"
    });
};

exports.findAllUser = async (req, res) => {
    try {
        const search = req.query.search || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        let queryObj = {};
        if (search) {
            queryObj.username = { $regex: search, $options: 'i' };
        }

        const doc = await UserModel.find(queryObj)
            .skip(skip)
            .limit(limit)
            .sort({ _id: -1 });
            
        const docCount = await UserModel.countDocuments(queryObj);
        const totalPage = Math.ceil(docCount / limit);
        
        res.status(200).send({
            msg: "Get",
            total: totalPage,
            result: doc
        });
    } catch (error) {
        console.error("Error in findAllUser:", error);
        res.status(500).send({ err: "Internal server error" });
    }
   
};

exports.updateUser = async (req, res) => {
    try {
        const id = req.params.id;

        // Security check: Prevent updating the password via this generic route
        // because it would save the password as plain text without hashing it.
        if (req.body.password) {
            return res.status(400).send({ err: "Passwords cannot be updated through this route." });
        }

        // Added { new: true, runValidators: true } to return the updated doc and enforce schema rules
        const doc = await UserModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        
        if (!doc) {
            return res.status(404).send({ err: "Document not found!" }); // Fixed sebd typo
        }
        
        res.status(200).send({
            msg: "Update successfully", // Fixed msf typo
            result: doc
        });
    } catch (error) {
        console.error("Error in updateUser:", error);
        res.status(500).send({ err: "Internal server error" });
    }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    // Prevent deleting yourself
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        err: "You cannot delete your own account"
      });
    }

    const doc = await UserModel.findByIdAndDelete(id);

    if (!doc) {
      return res.status(404).json({
        err: "Document not found!"
      });
    }

    res.status(200).json({
      msg: "Deleted successfully"
    });

  } catch (error) {
    console.error("Error in deleteUser:", error);

    res.status(500).json({
      err: "Internal server error"
    });
  }
};