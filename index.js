import express from 'express';
import { updateChat, chat } from './controller.js';

const app = express();
app.use(express.json());

const port = process.env.PORT || 8080;

// Routes
app.use('/updateChat', updateChat);
app.use('/chat', chat);

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
