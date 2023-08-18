const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const stripe = require("stripe")(`${process.env.stipe_key}`);


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xyvppop.mongodb.net/?retryWrites=true&w=majority`;

const uri = `mongodb://127.0.0.1:27017`;



// const uri = `mongodb://127.0.0.1:27017`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('flexFlow').collection('users');
    const moviesCollection = client.db('flexFlow').collection('movies');




    //users
    app.get('/users', async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      console.log(existingUser)
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //  movies  section

    app.get('/movies', async (req, res) => {
      const cursor = moviesCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.post('/movies', async (req, res) => {
      const movie = req.body;
      const result = await userCollection.insertOne(movie);
      res.send(result)
    })



    // payment system implement
    app.get('/create-payment-intent', async (req, res) => {
      // const { price } = req.body;
      // remove this when original payment is available
      const price = Math.floor(Math.random(100) * 100);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ["card"]
      })
      // console.log(amount);
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment complete data insert
    app.post("/payment", async (req, res) => {

    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hellow World')
})

app.listen(port, () => {
  console.log(`port is running on ${port}`);
})
