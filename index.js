const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middlewar
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.owfha.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .send({ message: "UnAuthorized access baincot ber ho" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctorService").collection("service");
    const bookingCollection = client.db("doctorService").collection("booking");
    const usersCollection = client.db("doctorService").collection("users");

    // get all data
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // add data in booking collections
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    // get booking list appointments
    app.get("/availabe", async (req, res) => {
      const date = req.query.date || "May 14, 2022";

      // step1 : get all services
      const services = await bookingCollection.find().toArray();

      // step2: get the booking of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step3 : for each service
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );

        const bookedSlotes = serviceBookings.map((book) => book.slot);

        const availabe = service.slots?.filter(
          (slot) => !bookedSlotes.includes(slot)
        );
        service.slots = availabe;
      });

      res.send(services);
    });

    // get filtered item by    query email
    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const booking = await bookingCollection.find(query).toArray();
        return res.send(booking);
      }else{
        return res.status(403).send({ message: "Forbidden access" });
      }
    });

    // get all users
    app.get('/users', verifyJWT, async(req, res)=>{
        const query = {}
        const result = await usersCollection.find(query).toArray()
        res.send(result)
    })


    // get users by email
    app.put("/user/:email", async (req, res) => {
      const user = req.body;
      const email = req.params.email;
      const filter = { email: email };
      const option = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    // make admin
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({email: requester})
      if(requesterAccount.role === 'admin'){
        const filter = { email: email };
      const updatedDoc = {
        $set: {role: 'admin'},
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);

      }else{
        return res.status(403).send({ message: "Forbidden access" });
      }



      // check admin
      app.get('/user/:email', async(req, res)=>{
        const email = req.params.email;
        const user = await usersCollection.findOne({email : email})
        const isAdmin = user.role === "admin";
        res.send({admin: isAdmin})
      })







      
    });


  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("doctors portal backend running");
});

app.listen(port, () => {
  console.log("doctors portal running", port);
});
