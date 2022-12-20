const express = require('express');
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config();

const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;

const stripe = require('stripe')(process.env.STRIPE_SECRET);

const app = express();
const port = process.env.PORT || 5000;

// const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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


        // get appoinments in UI by filtering email
        app.get('/appoinments', async(req,res)=>{
            const email = req.query.email;
            const date = req.query.date;
            const query = {email: email,  date: date };
            const cursor = appoinmentsCollection.find(query);
            const appoinments = await cursor.toArray();
            res.json(appoinments);
            console.log(appoinments);
        });

        // get admins from db
        app.get('/users/:email', async(req,res)=>{
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
                isAdmin= 'true';
            }
            res.json({admin: isAdmin});
        });


        // get payment service info
        app.get('/appoinments/:id', async(req,res)=> {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            console.log(query);
            const result = await appoinmentsCollection.findOne(query);
            console.log('result: ',result);
            res.json(result);
        })

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
            console.log(result);
            res.json(result);
        })

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
            // console.log(req.decodedEmail);
            const filter = { email: user.email };
            const updateDoc = { $set:{ role: 'admin'} };
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
        })


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