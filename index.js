import express from 'express';
import { updateChat, chat } from './controller.js';
import { createUser, getUsers } from './user.js';
import mongoose from 'mongoose';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 8080;


mongoose
  .connect(process.env.MONGODB_URI)
  .then(console.log('MongoDb connected'))
  .catch((err) => console.log('Mongo Error', err));


// Routes
app.post('/createUser', createUser);
app.get('/getUsers', getUsers);

app.use('/updateChat', updateChat);
app.use('/chat', chat);

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
