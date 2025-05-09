import { User } from "./schemas/user.js";

const createUser = async (req, res) => {
  const { name, email, contact, address } = req.body;
  const user = new User({ name, email, contact, address });
  await user.save();
  res.status(200).json({ message: "User created successfully" });
};

const getUsers = async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const users = await User.find({})
    .sort(sort)
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  res.status(200).json({ users: users });
};

export { createUser, getUsers };
