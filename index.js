const express = require('express');
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config();

const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;

const stripe = require('stripe')(process.env.STRIPE_SECRET);

const app = express();
const port = process.env.PORT || 5000;

const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

// --------------------------------------------------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gqaks.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken(req, res, next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];
    }
    try{
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.decodedEmail = decodedUser.email;
    }
    catch{

    }

    next();
}



async function run(){
    try{
        await client.connect();

        const database = client.db("Doctors_Portal");
        const appoinmentsCollection = database.collection("Appoinments");
        const usersCollection = database.collection("Users");
        const reviewCollection = database.collection("Reviews");
        const testReportCollection = database.collection("TestReport");
        const bloodDonorsCollection = database.collection("BloodDonor");





                // ------------------------------------ get request ----------------------------------

        // get all appoinments
        
        app.get('/appoinments', async(req,res)=>{
            const cursor = appoinmentsCollection.find({});
            const appoinments = await cursor.toArray();
            res.json(appoinments);
            console.log(appoinments);
        });

        // get appoinments in UI by filtering email
        app.get('/appoinments/find', async(req,res)=>{
            console.log("appointments: " + req.body);
            const email = req.query.email;
            const date = req.query.date;
            const query = {email: email,  date: date };
            const cursor = appoinmentsCollection.find(query);
            const appoinments = await cursor.toArray();
            res.json(appoinments);
            // console.log(appoinments);
        });


        // get admins from db
        app.get('/users/admin/:email', async(req,res)=>{
            const email = req.params.email;
            const query = { email: email };
            console.log(query);
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
                isAdmin= 'true';
            }
            res.json({admin: isAdmin});
        });

        // get doctors from db
        app.get('/users/doctor/:email', async(req,res)=>{
            const email = req.params.email;
            const query = { email: email };

            const user = await usersCollection.findOne(query);

            let isDoctor = false;

            if(user?.role === 'doctor'){
                isDoctor= 'true';
            }
            res.json({doctor: isDoctor});
        });

        // get user info
        app.get('/users', async(req,res)=> {

            const cursor = await usersCollection.find();
            const users = await cursor.toArray();
            res.json(users);
            // console.log(users);
        });


        // get payment service info
        app.get('/appoinments/:id', async(req,res)=> {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            console.log(query);
            const result = await appoinmentsCollection.findOne(query);
            // console.log('result: ',result);
            res.json(result);
        });

        // GET all reviews
        app.get('/reviews', async (req, res) => {
            const cursor =  reviewCollection.find({});
            const reviews = await cursor.toArray();
            res.send(reviews);
        });


        app.get('/reports', async(req, res) => {
            const cursor = testReportCollection.find({});
            const reports = await cursor.toArray();
            res.send(reports);
        });



        // GET all donors
        app.get('/donors', async (req, res) => {
            const cursor =  bloodDonorsCollection.find({});
            const donors = await cursor.toArray();
            res.send(donors);
        });




                // ------------------------------------ post request ----------------------------------

        // add all appoinments to db
        app.post('/appoinments', async(req,res)=>{
            const appoinment = req.body;
            const result = await appoinmentsCollection.insertOne(appoinment);
            res.json(result);
        })

        // add all user to db
        app.post('/users', async(req,res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            // console.log(result);
            res.json(result);
        });


        // post review api to db
        app.post('/reviews', async(req,res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.json(result);
        });


        app.post('/reports', async(req, res) => {
            const reports = req.body;
            const result = await testReportCollection.insertOne(reports);
            res.json(result);
        });


        // post blood donors api to db
        app.post('/donors', async(req,res) => {
            const donor = req.body;
            const result = await bloodDonorsCollection.insertOne(donor);
            res.json(result);
        });






        // ------------------------------------ put request ----------------------------------

        // update user for google log in
        app.put('/users', async(req,res)=>{
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set:user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);

        });
        

        // add admin role
        app.put('/users/admin', verifyToken, async(req,res)=>{
            const user = req.body;
            console.log("admin", req.decodedEmail);

            const filter = { email: user.email };
            console.log(filter);
            const updateDoc = { $set:{ role: 'admin'} };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);

        });


        
        // add doctor role
        app.put('/users/doctor', async(req,res)=>{
            const user = req.body;
            console.log(user);

            const filter = { email: user.email };
            console.log(filter);

            const updateDoc = { $set:{ role: 'doctor'} };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);

        });



        // post payment method
        app.post('/create-payment-intent', async(req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            })
            res.json({ clientSecret: paymentIntent.client_secret});
        });

        // update paid appoinment
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };

            const result = await appoinmentsCollection.updateOne(filter, updateDoc);
            res.json(result);
        });


        //DELETE car API
        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await reviewCollection.deleteOne(query);
            res.json(1);
        });

        //DELETE car API
        app.delete('/donors/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await bloodDonorsCollection.deleteOne(query);
            res.json(1);
        });


    }
    finally{
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req,res)=>{
    res.send('Welcome to DentCare server');
});
app.listen(port, ()=>{
    console.log('Running on port: ', port);
});