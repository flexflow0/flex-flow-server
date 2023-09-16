const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const SSLCommerzPayment = require('sslcommerz-lts')

const app = express()
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorization access' })
    }
    req.decoded = decoded;
    next();
  })

}

// -----------------------------
// const decodedEmail = req.decoded.email;
// if(email !== decodedEmail){
//   return res.status(403).send({ error: true, message: 'forbidden access' })
// }
// --------------------------------

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
    const SSLPaymentQuery = client.db('flexFlow').collection('SSLPaymentQuery');
    const upComingMoviesCollection = client.db('flexFlow').collection('upcomingMovies');
    const tvSeriesCollection = client.db('flexFlow').collection('tvSeries');
    const blogCollection = client.db('flexFlow').collection('blog');
    const watchHistoryCollection = client.db("flexFlow").collection("watch-history")


    // -------- jwt ---------

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })
    // ----------------------------------

    // ----------verifyAdmin------------
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }



    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;

      // if (req.decoded.email !== email) {
      //   return res.status(403).send({ error: true, message: 'forbidden message' })
      // }
      const query = { email: email, role: "admin" };
      const user = await userCollection.findOne(query);

      console.log("id", user);
      res.send(user);
    })

    //users
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
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

    app.patch('/user/update', async (req, res) => {
      const upData = req.body;

      const query = { email: upData.email }
      const update = {
        $set: {
          age: upData?.age,
          role: "user", nonSubscribed: true,

        }
      }
      const result = await userCollection.updateOne(query, update);

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
    // Get Single Movies 
    app.get('/singleMovie/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const movie = await moviesCollection.findOne(query);
      res.send(movie)
    })
    // Post Movies
    app.post('/movies', async (req, res) => {
      const movie = req.body;
      const result = await moviesCollection.insertOne(movie);
      res.send(result)
    })

    // ************  Tv Series       *******  Masud Rana *******

    app.get('/tvSeries', async (req, res) => {
      const queries = req.query;
      const region = queries.region;
      const result = await tvSeriesCollection.find(region ? { "region": region } : {}).toArray();
      res.send(result)
    })

    app.post('/tvSeries', async (req, res) => {
      const tvSeries = req.body;
      const result = await tvSeriesCollection.insertOne(tvSeries)
      res.send(result)
    })



    //******** payment system implement  *********

    // get user specific payment History
    app.get("/payment-history", async (req, res) => {

      const query = req.query
      console.log(query);
      if (query) {
        const result = await paymentCollection.find(query).toArray()
        console.log(result);
        res.send(result)
      }
    })

    // payment intent of stripe
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


    const transactionId = new ObjectId().toString()
    //sslcommerz init
    app.post('/ssl-payment', async (req, res) => {
      const paymentInfo = req.body
      const data = {
        total_amount: paymentInfo?.price,
        currency: paymentInfo?.currency,
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success/${transactionId}`,
        fail_url: `http://localhost:5000/payment/failed/${transactionId}`,
        cancel_url: `http://localhost:5000/payment/failed/${transactionId}`,
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

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })

        const finalOrder = {
          ...paymentInfo, paidStatus: false, transactionId: transactionId, paymentMethod: "SSLCommerz"
        }
        const result = SSLPaymentQuery.insertOne(finalOrder)
        console.log('Redirecting to: ', GatewayPageURL)
      });


    })
    app.post("/payment/success/:transactionId", async (req, res) => {
      const updateQuery = await SSLPaymentQuery.updateOne({ transactionId: req.params.transactionId }, {
        $set: {
          paidStatus: true
        }
      })
      console.log("1", updateQuery);
      if (updateQuery.modifiedCount > 0) {
        const getPayment = await SSLPaymentQuery.findOne({ transactionId: req.params.transactionId })
        console.log("2", getPayment);
        if (getPayment) {
          const result = await paymentCollection.insertOne(getPayment)
          console.log("3", result);
          if (result.insertedId) {
            const removeSSLQ = await SSLPaymentQuery.deleteOne({ transactionId: req.params.transactionId })
            console.log("4", removeSSLQ);
            if (removeSSLQ.deletedCount > 0) {
              res.redirect(`http://localhost:5173/payment/success/${req.params.transactionId}`)
            }
          }
        }
      }

    });


    app.post("/payment/failed/:transactionId", async (req, res) => {
      const deleteQuery = await SSLPaymentQuery.deleteOne({ transactionId: req.params.transactionId }
      )
      if (deleteQuery.deletedCount) {
        res.redirect(`http://localhost:5173/payment/failed/${req.params.transactionId}`)
      }
    });




    // Upcoming Movies => Masud Rana
    app.get('/upcomingmovies', async (req, res) => {
      const result = await upComingMoviesCollection.find().toArray();
      res.send(result)
    })

    // To Do Masud Rana

    app.post('/upcomingmovies', async (req, res) => {
      const movie = req.body;
      const result = await userCollection.insertOne(movie);
      res.send(result)
    })

    //*********** */ blog ********
    app.get('/blog', async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result)
    })

    app.post('/blog', async (req, res) => {
      const blogItem = req.body;
      const result = await blogCollection.insertOne(blogItem)
      res.send(result)
    })


    // Atik -> watch History
    app.get("/watch-history/:email", async (req, res) => {
      const email = req.params.email;
      if (email) {
        const query = { email: email };
        const finData = await watchHistoryCollection.findOne(query);
        if (finData.movieID) {
          const movieIDs = finData?.movieID
          // Find all movies by their IDs
          const moviesQuery = { _id: { $in: movieIDs.map(id => new ObjectId(id)) } };
          const result = await moviesCollection.find(moviesQuery).toArray()
          res.send(result)
        }
      }
    })
    // Atik -> watch History
    app.patch("/watch-history", async (req, res) => {
      const watchData = req.body;
      const query = { email: watchData.email };
      const findData = await watchHistoryCollection.findOne(query);
      const isMovieIDAvailable = findData && findData.movieID.includes(watchData?.movieID);

      if (watchData.movieID.length > 5) {
        if (findData) {
          if (!isMovieIDAvailable) {
            console.log("if", watchData);

            const upDoc = {
              $set: {
                email: watchData?.email,
                movieID: [watchData?.movieID, ...(findData?.movieID)]
              }
            }
            const result = await watchHistoryCollection.updateOne(query, upDoc, { upsert: true })
            console.log(result);
            res.send(result)
          } else {
            console.log("already into watch history");

            if (isMovieIDAvailable) {
              // Movie is already in the watch history; move it to the top
              const movieIDIndex = findData.movieID.indexOf(watchData.movieID);

              if (movieIDIndex !== -1) {
                // Remove the movieID from the current position
                findData.movieID.splice(movieIDIndex, 1);
              }
              // Add it to the beginning of the array
              findData.movieID.unshift(watchData.movieID);

              const upDoc = {
                $set: {
                  email: watchData?.email,
                  movieID: findData.movieID,
                },
              };

              const result = await watchHistoryCollection.updateOne(query, upDoc, { upsert: true });
              console.log(result);
              res.send(result);
            }
          }
        } else {
          console.log("else", watchData);
          const docUp = {
            email: watchData?.email,
            movieID: [watchData?.movieID]

          }
          const result = await watchHistoryCollection.insertOne(docUp)
          console.log(result);
          res.send(result)
        }
      }
    });



    // ***********

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

