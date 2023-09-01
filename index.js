const express = require('express')
const cors = require('cors')
require('dotenv').config()
const SSLCommerzPayment = require('sslcommerz-lts')

const app = express()
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const stripe = require("stripe")(`${process.env.STRIPE_KEY}`);


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xyvppop.mongodb.net/?retryWrites=true&w=majority`;

// const uri = `mongodb://127.0.0.1:27017`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const store_id = process.env.StoreID
const store_passwd = `${process.env.StorePassword}`
const is_live = false //true for live, false for sandbox


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('flexFlow').collection('users');
    const moviesCollection = client.db('flexFlow').collection('movies');
    const paymentCollection = client.db('flexFlow').collection('payment');

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

    //  movies section
    app.get('/movies', async (req, res) => {
      const queries = req.query;
      const region = queries.region;
      const genre = queries.genre;
      let query = {};
      if (region === 'undefined' && genre === 'undefined') {
        query = {};
      }
      else if (region === 'undefined') {
        query = { "Genres": genre };
        console.log(query, 1);
      }
      else if (genre === 'undefined') {
        query = { "region": region };
        console.log(query, 2);
      }
      // console.log(query);
      const result = await moviesCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/singleMovie/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const movie = await moviesCollection.findOne(query);
      res.send(movie)
    })

    app.post('/movies', async (req, res) => {
      const movie = req.body;
      const result = await userCollection.insertOne(movie);
      res.send(result)
    })

    // payment system implement
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      console.log(price);
      // remove this when original payment is available
      // const price = Math.floor(Math.random(100) * 100);
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
    app.post("/payment-stripe", async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)
      res.send(result)

    })


    const transactionID = new ObjectId().toString()
    //sslcommerz init
    app.post('/ssl-payment', async (req, res) => {
      const paymentInfo = req.body
      const data = {
        total_amount: paymentInfo?.price,
        currency: paymentInfo?.currency,
        tran_id: transactionID, // use unique tran_id for each api call
        success_url: 'http://localhost:3030/success',
        fail_url: 'http://localhost:3030/fail',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: paymentInfo?.plan,
        product_category: 'Subscription',
        product_profile: 'FlexFlow',
        cus_name: paymentInfo?.name,
        cus_email: paymentInfo?.email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: paymentInfo?.number,
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      console.log(data);
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL)
      });
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
  res.send('Hello World')
})

app.listen(port, () => {
  console.log(`port is running on ${port}`);
})
