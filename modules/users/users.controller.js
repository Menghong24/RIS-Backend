const bcryptjs = require('bcryptjs');
const { UserModel } = require('./users.model');
const jwt = require('jsonwebtoken');

const ALLOWED_ROLES = ['admin', 'teacher', 'user'];

const normalizeRole = (role) => {
  const normalizedRole = String(role || 'user').trim().toLowerCase();
  return ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : null;
};

exports.createUser = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const role = normalizeRole(req.body?.role || 'user');

    if (!username || !password) {
      return res.status(400).send({
        err: 'Username and password are required'
      });
    }

    if (!role) {
      return res.status(400).send({
        err: 'Invalid role'
      });
    }

    const existingUser = await UserModel.findOne({
      username
    });

    if (existingUser) {
      return res.status(409).send({
        err: 'Username already exists'
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await UserModel.create({
      username,
      password: hashedPassword,
      role
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).send({
      msg: 'created',
      result: userResponse
    });
  } catch (error) {
    console.error('Error in createUser:', error);

    return res.status(500).send({
      err: 'Internal server error'
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).send({
        err: 'Username and password are required'
      });
    }

    const user = await UserModel.findOne({
      username
    }).select('+password');

    if (!user) {
      return res.status(401).send({
        err: 'Invalid credentials'
      });
    }

    const isMatch = await bcryptjs.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).send({
        err: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    );

    return res.status(200).send({
      msg: 'login successfully!',
      token
    });
  } catch (error) {
    console.error('Error in loginUser:', error);

    return res.status(500).send({
      err: 'Internal server error'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).send({
        err: 'User not found!'
      });
    }

    return res.status(200).send({
      msg: 'Get profile',
      result: user
    });
  } catch (error) {
    console.error('Error in getProfile:', error);

    return res.status(500).send({
      err: 'Internal server error'
    });
  }
};

exports.logOut = async (req, res) => {
  return res.status(200).send({
    msg: 'Logout successfully!'
  });
};

exports.findAllUser = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const rawRole = String(req.query.role || '').trim().toLowerCase();
    const role = ALLOWED_ROLES.includes(rawRole) ? rawRole : '';

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const queryObj = {};

    if (search) {
      queryObj.username = {
        $regex: search,
        $options: 'i'
      };
    }

    // បើ role = admin / teacher / user ទើប filter
    // បើ role ទទេ ឬ all នឹងបង្ហាញទាំងអស់
    if (role) {
      queryObj.role = role;
    }

    console.log('REQ QUERY:', req.query);
    console.log('MONGO QUERY:', queryObj);

    const docCount = await UserModel.countDocuments(queryObj);

    const doc = await UserModel.find(queryObj)
      .select('-password')
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);

    const totalPage = Math.ceil(docCount / limit) || 1;

    return res.status(200).send({
      msg: 'Get',
      total: totalPage,
      totalUsers: docCount,
      result: doc
    });
  } catch (error) {
    console.error('Error in findAllUser:', error);

    return res.status(500).send({
      err: 'Internal server error'
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.body.password) {
      return res.status(400).send({
        err: 'Passwords cannot be updated through this route.'
      });
    }

    const payload = {};

    if (req.body.username !== undefined) {
      const username = String(req.body.username || '').trim();

      if (!username) {
        return res.status(400).send({
          err: 'Username is required'
        });
      }

      payload.username = username;
    }

    if (req.body.role !== undefined) {
      const role = normalizeRole(req.body.role);

      if (!role) {
        return res.status(400).send({
          err: 'Invalid role'
        });
      }

      payload.role = role;
    }

    const doc = await UserModel.findByIdAndUpdate(
      id,
      payload,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!doc) {
      return res.status(404).send({
        err: 'Document not found!'
      });
    }

    return res.status(200).send({
      msg: 'Update successfully',
      result: doc
    });
  } catch (error) {
    console.error('Error in updateUser:', error);

    if (error.code === 11000) {
      return res.status(409).send({
        err: 'Username already exists'
      });
    }

    return res.status(500).send({
      err: 'Internal server error'
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.user?._id?.toString() === id) {
      return res.status(400).json({
        err: 'You cannot delete your own account'
      });
    }

    const doc = await UserModel.findByIdAndDelete(id);

    if (!doc) {
      return res.status(404).json({
        err: 'Document not found!'
      });
    }

    return res.status(200).json({
      msg: 'Deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteUser:', error);

    return res.status(500).json({
      err: 'Internal server error'
    });
  }
};