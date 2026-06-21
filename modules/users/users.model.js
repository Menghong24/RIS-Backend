const { default: mongoose } = require("mongoose");

const usersSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username is required"],
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: [true, "Password is required"], 
        select: false // Fixed the "sesect" typo to protect passwords by default
    },
    role: {
        type: String,
        enum: ["admin", "teacher", "user"], // Added "user" to align with frontend options
        default: "user"
    }
}, { 
    timestamps: true // Enables createdAt and updatedAt for your frontend table view
});

exports.UserModel = mongoose.model("User", usersSchema);