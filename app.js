const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');

const app = express();

const mongoUrl = 'mongodb://localhost:27017/site';
const client = new MongoClient(mongoUrl);

let usersCollection;
let tasksCollection;

app.set('view engine', 'pug');
app.set('views', './views');

app.use(express.static(`${__dirname}/assets`));

app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  store: MongoStore.create({
    mongoUrl,
    collectionName: 'sessions',
    ttl: 60 * 60,
  }),
  secret: 'your_secret_key_39393',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 },
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use(morgan('tiny'));

app.use((req, _res, next) => {
  app.locals.user = req.session?.user || null;
  next();
});

app.get('/', (_req, res) => {
  res.render('main');
});

app.get('/register', (_req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  let { email, password, role } = req.body;
  email = email.trim().toLowerCase();
  role = (role || 'user').toLowerCase();

  const exists = await usersCollection.findOne({ email });

   if (exists) {
    req.flash('error', 'user exists');
    return res.redirect('/register');
  }

  const hash = await bcrypt.hash(password.trim(), 10);

  await usersCollection.insertOne({
    email,
    password: hash,
    role
  });

  req.flash('success', 'user created successfully, please login');
  res.redirect('/login');
});

app.get('/login', (_req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  let { email, password } = req.body;
  email = email.trim().toLowerCase();

  const user = await usersCollection.findOne({ email });
  if (!user) {
    req.flash('error', 'login or password is incorrect');
    return res.render('login', { error: 'login or password is incorrect' });
  }

  const valid = await bcrypt.compare(password.trim(), user.password);
  if (!valid) {
    req.flash('error', 'login or password is incorrect');
    return res.render('login', { error: 'login or password is incorrect' });
  }

  req.session.user = { email: user.email, role: user.role };
  res.redirect('/dashboard');
});

app.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const { role, email } = req.session.user;
  const tasks = await tasksCollection.find({ role }).toArray();

  res.render('dashboard', { user: email, tasks });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

async function dbConnect() {
  try {
    await client.connect();
    const db = client.db('site');
    usersCollection = db.collection('users');
    tasksCollection = db.collection('tasks');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

dbConnect().then(() => {
  app.listen(3500, () => {
    console.log('Server http://localhost:3500');
  });
});
