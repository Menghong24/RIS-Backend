const { default: mongoose } = require("mongoose");

async function connectDatabase() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/db_school_management')
        console.log('Database connected successfully');    
    } catch (error){
        console.log('Error conecting to the database:',error)
    };
    
}
module.exports = connectDatabase;