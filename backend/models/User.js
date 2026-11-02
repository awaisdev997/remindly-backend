import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Letters-only regex — no spaces, digits, or special characters
const lettersOnly = /^[A-Za-z]+$/;

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true,
    match: [lettersOnly, 'First name must contain letters only (no spaces, numbers, or special characters)'],
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true,
    match: [lettersOnly, 'Last name must contain letters only (no spaces, numbers, or special characters)'],
  },
  gender: {
    type: String,
    required: [true, 'Please select a gender'],
    enum: {
      values: ['Male', 'Female'],
      message: 'Gender must be either Male or Female',
    },
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
}, { timestamps: true });

// Virtual: full name for backward compatibility with existing responses
userSchema.virtual('name').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Hash password before saving (only when modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare plain password against hashed
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
